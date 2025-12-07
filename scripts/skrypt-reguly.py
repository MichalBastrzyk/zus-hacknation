#!/usr/bin/env python3
"""
Skrypt do generowania reguł eksperckich z dokumentacji wypadków.
Wykorzystuje Gemini 2.5 Flash do analizy dokumentów i generowania
reguł w formacie JSON z walidacją Pydantic.
"""

import google.generativeai as genai
import os
import json
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator
from pathlib import Path

# =============================================================================
# KONFIGURACJA
# =============================================================================

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash-lite")

# Ścieżki
FOLDER_WYNIKI_TEKST = Path("./wyniki_tekst")
FOLDER_REGULY = Path("./reguly")
FOLDER_REGULY.mkdir(exist_ok=True)

# Konfiguracja przetwarzania
MAX_WORKERS = 1  # Jeden wątek dla free tier (15 RPM limit)
DELAY_BETWEEN_REQUESTS = 5  # Sekundy między requestami (rate limiting)
MAX_RETRIES = 3  # Maksymalna liczba prób przy błędzie

# Thread-safe liczniki
lock = Lock()
licznik_przetworzonych = 0
licznik_pomietych = 0
licznik_bledow = 0

# =============================================================================
# MODELE PYDANTIC - SCHEMAT REGUŁY
# =============================================================================


class MetaData(BaseModel):
    """Metadane zdarzenia wypadkowego."""

    data_zdarzenia: str = Field(..., description="Data w formacie YYYY-MM-DD")
    godzina_zdarzenia: str = Field(..., description="Godzina w formacie HH:MM")
    miejsce_zdarzenia: str = Field(
        ..., description="Miejsce zdarzenia np. warsztat, biuro, droga do pracy"
    )
    rodzaj_urazu: str = Field(..., description="Rodzaj urazu z dokumentacji medycznej")

    @field_validator("data_zdarzenia")
    @classmethod
    def validate_data(cls, v: str) -> str:
        # Akceptuj różne formaty, ale preferuj YYYY-MM-DD
        if v and v not in ["BRAK", "NIEZNANA", "brak", "nieznana"]:
            # Próba normalizacji formatu
            v = v.strip()
        return v

    @field_validator("godzina_zdarzenia")
    @classmethod
    def validate_godzina(cls, v: str) -> str:
        if v and v not in ["BRAK", "NIEZNANA", "brak", "nieznana"]:
            v = v.strip()
        return v


class AnalizaDecyzji(BaseModel):
    """Analiza decyzji w sprawie wypadku."""

    status: Literal["UZNANY", "NIEUZNANY"] = Field(
        ..., description="Status decyzji: UZNANY lub NIEUZNANY"
    )
    powod_odrzucenia: str = Field(
        ..., description="Powód odrzucenia (BRAK jeśli uznany)"
    )
    podstawa_prawna_cytat: str = Field(
        ..., description="Dosłowny cytat z Opinii Prawnej uzasadniający decyzję"
    )


class RegulaEkspercka(BaseModel):
    """Reguła ekspercka wyciągnięta z przypadku."""

    warunek: str = Field(
        ...,
        description="Zwięzły opis okoliczności np. 'Upadek na śliskiej nawierzchni w miejscu pracy'",
    )
    logika: str = Field(
        ...,
        description="Logika w formacie: JEŚLI [okoliczności] ORAZ [warunek] TO [decyzja] PONIEWAŻ [uzasadnienie]",
    )
    kategoria_problemu: Literal[
        "PRZYCZYNA_ZEWNETRZNA",
        "NAGLOSC",
        "ZWIAZEK_Z_PRACA",
        "STAN_NIETRZEZWOSCI",
        "INNE",
    ] = Field(..., description="Kategoria problemu prawnego")


class WnioskiDlaBota(BaseModel):
    """Wnioski dla chatbota decyzyjnego."""

    czego_szukac_w_przyszlosci: str = Field(
        ...,
        description="Wskazówka o co pytać w podobnych sprawach",
    )
    ryzyko_odrzucenia: Literal["NISKIE", "SREDNIE", "WYSOKIE"] = Field(
        ..., description="Ocena ryzyka dla podobnych spraw"
    )


class RegulaWypadku(BaseModel):
    """Kompletna reguła wypadku - główny model."""

    meta_data: MetaData
    analiza_decyzji: AnalizaDecyzji
    fakty_kluczowe: list[str] = Field(
        ..., min_length=1, description="Lista kluczowych faktów"
    )
    regula_ekspercka: RegulaEkspercka
    wnioski_dla_bota: WnioskiDlaBota
    brakujace_dokumenty: list[str] = Field(
        default_factory=list, description="Lista brakujących dokumentów"
    )


# =============================================================================
# FUNKCJE POMOCNICZE
# =============================================================================


def znajdz_dokument(folder: Path, wzorce: list[str]) -> Optional[Path]:
    """
    Znajduje dokument w folderze pasujący do jednego z wzorców (case-insensitive).
    """
    for plik in folder.iterdir():
        if not plik.is_file():
            continue
        nazwa_lower = plik.name.lower()
        for wzorzec in wzorce:
            if wzorzec in nazwa_lower:
                return plik
    return None


def znajdz_dokumenty(folder: Path) -> dict[str, Optional[Path]]:
    """
    Znajduje wszystkie 4 typy dokumentów w folderze wypadku.
    Zwraca słownik z nazwami typów i ścieżkami (lub None jeśli brak).
    """
    dokumenty = {
        "karta_wypadku": znajdz_dokument(folder, ["karta wypadku", "karta_wypadku"]),
        "opinia": znajdz_dokument(folder, ["opinia"]),
        "wyjasnienia_poszkodowanego": znajdz_dokument(
            folder,
            [
                "wyjaśnień poszkodowanego",
                "wyjaśnienia poszkodowanego",
                "wyjasnienia poszkodowanego",
            ],
        ),
        "zawiadomienie": znajdz_dokument(
            folder, ["zawiadomienie o wypadku", "zawiadomienie_o_wypadku"]
        ),
    }
    return dokumenty


def wczytaj_dokument(sciezka: Optional[Path]) -> str:
    """Wczytuje treść dokumentu lub zwraca informację o braku."""
    if sciezka is None:
        return "[DOKUMENT NIEDOSTĘPNY]"
    try:
        return sciezka.read_text(encoding="utf-8")
    except Exception as e:
        return f"[BŁĄD ODCZYTU: {e}]"


def wyodrebnij_numer_wypadku(nazwa_folderu: str) -> Optional[int]:
    """Wyodrębnia numer wypadku z nazwy folderu."""
    match = re.search(r"wypadek\s*(\d+)", nazwa_folderu, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def zbuduj_prompt(dokumenty: dict[str, str], brakujace: list[str]) -> str:
    """Buduje prompt dla modelu Gemini."""
    prompt = """Jesteś ekspertem ds. prawa pracy i wypadków przy pracy w Polsce. 
Twoim zadaniem jest przeanalizować dokumentację wypadku i wygenerować regułę ekspercką.

DOKUMENTACJA WYPADKU:

=== KARTA WYPADKU ===
{karta_wypadku}

=== OPINIA PRAWNA ===
{opinia}

=== WYJAŚNIENIA POSZKODOWANEGO ===
{wyjasnienia_poszkodowanego}

=== ZAWIADOMIENIE O WYPADKU ===
{zawiadomienie}

{info_brakujace}

INSTRUKCJE:
1. Przeanalizuj wszystkie dostępne dokumenty.
2. Wyciągnij kluczowe informacje o wypadku.
3. Określ czy wypadek został UZNANY czy NIEUZNANY za wypadek przy pracy.
4. Zidentyfikuj główny problem prawny i sformułuj regułę ekspercką.
5. Odpowiedz TYLKO czystym JSON-em bez żadnych znaczników markdown (bez ```json).

WYMAGANE WARTOŚCI ENUM:
- status: tylko "UZNANY" lub "NIEUZNANY"
- kategoria_problemu: tylko "PRZYCZYNA_ZEWNETRZNA", "NAGLOSC", "ZWIAZEK_Z_PRACA", "STAN_NIETRZEZWOSCI" lub "INNE"
- ryzyko_odrzucenia: tylko "NISKIE", "SREDNIE" lub "WYSOKIE"

SCHEMAT JSON (odpowiedz dokładnie w tym formacie):
{{
  "meta_data": {{
    "data_zdarzenia": "YYYY-MM-DD (lub NIEZNANA jeśli brak)",
    "godzina_zdarzenia": "HH:MM (lub NIEZNANA jeśli brak)",
    "miejsce_zdarzenia": "opis miejsca",
    "rodzaj_urazu": "opis urazu"
  }},
  "analiza_decyzji": {{
    "status": "UZNANY" lub "NIEUZNANY",
    "powod_odrzucenia": "opis powodu (lub BRAK jeśli uznany)",
    "podstawa_prawna_cytat": "dosłowny cytat z opinii prawnej"
  }},
  "fakty_kluczowe": [
    "fakt 1",
    "fakt 2",
    "fakt 3"
  ],
  "regula_ekspercka": {{
    "warunek": "zwięzły opis okoliczności",
    "logika": "JEŚLI [okoliczności] ORAZ [warunek] TO [decyzja] PONIEWAŻ [uzasadnienie]",
    "kategoria_problemu": "jedna z: PRZYCZYNA_ZEWNETRZNA, NAGLOSC, ZWIAZEK_Z_PRACA, STAN_NIETRZEZWOSCI, INNE"
  }},
  "wnioski_dla_bota": {{
    "czego_szukac_w_przyszlosci": "wskazówka dla podobnych spraw",
    "ryzyko_odrzucenia": "NISKIE, SREDNIE lub WYSOKIE"
  }}
}}
"""
    info_brakujace = ""
    if brakujace:
        info_brakujace = f"\nUWAGA: Brakujące dokumenty: {', '.join(brakujace)}. Bazuj na dostępnych dokumentach.\n"

    return prompt.format(
        karta_wypadku=dokumenty.get("karta_wypadku", "[BRAK]"),
        opinia=dokumenty.get("opinia", "[BRAK]"),
        wyjasnienia_poszkodowanego=dokumenty.get(
            "wyjasnienia_poszkodowanego", "[BRAK]"
        ),
        zawiadomienie=dokumenty.get("zawiadomienie", "[BRAK]"),
        info_brakujace=info_brakujace,
    )


def wyczysc_json_response(text: str) -> str:
    """Usuwa znaczniki markdown z odpowiedzi JSON."""
    # Usuń ```json i ```
    text = re.sub(r"^```json\s*", "", text.strip())
    text = re.sub(r"^```\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text.strip())
    return text.strip()


def przetworz_wypadek(zadanie: dict) -> dict:
    """
    Przetwarza pojedynczy wypadek - funkcja dla wątku.
    """
    folder = zadanie["folder"]
    numer = zadanie["numer"]
    sciezka_wyjscia = zadanie["sciezka_wyjscia"]

    result = {"numer": numer, "status": "ok", "error": None}

    try:
        # 1. Znajdź i wczytaj dokumenty
        dokumenty_sciezki = znajdz_dokumenty(folder)

        brakujace = []
        dokumenty_tresc = {}

        for nazwa, sciezka in dokumenty_sciezki.items():
            if sciezka is None:
                brakujace.append(nazwa)
            dokumenty_tresc[nazwa] = wczytaj_dokument(sciezka)

        # 2. Zbuduj prompt
        prompt = zbuduj_prompt(dokumenty_tresc, brakujace)

        # 3. Wywołaj Gemini z retry
        response_text = None
        last_error = None

        for attempt in range(MAX_RETRIES):
            try:
                # Rate limiting
                time.sleep(DELAY_BETWEEN_REQUESTS)

                response = model.generate_content(prompt)
                response_text = response.text
                break

            except Exception as e:
                last_error = e
                if "429" in str(e) or "quota" in str(e).lower():
                    # Rate limit - czekaj dłużej
                    wait_time = (attempt + 1) * 30
                    print(
                        f"  ⏳ Rate limit dla wypadku {numer}, czekam {wait_time}s..."
                    )
                    time.sleep(wait_time)
                else:
                    time.sleep(5)

        if response_text is None:
            raise Exception(
                f"Nie udało się uzyskać odpowiedzi po {MAX_RETRIES} próbach: {last_error}"
            )

        # 4. Parsuj i waliduj JSON
        clean_json = wyczysc_json_response(response_text)

        try:
            data = json.loads(clean_json)
        except json.JSONDecodeError as e:
            raise Exception(f"Niepoprawny JSON: {e}\nOdpowiedź: {clean_json[:500]}")

        # Dodaj informacje o brakujących dokumentach
        data["brakujace_dokumenty"] = brakujace

        # 5. Walidacja Pydantic
        try:
            regula = RegulaWypadku.model_validate(data)
        except Exception as e:
            raise Exception(
                f"Błąd walidacji Pydantic: {e}\nDane: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}"
            )

        # 6. Zapisz do pliku
        with open(sciezka_wyjscia, "w", encoding="utf-8") as f:
            json.dump(regula.model_dump(), f, ensure_ascii=False, indent=2)

        result["status"] = "ok"

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)

    return result


def zbierz_zadania() -> list[dict]:
    """Zbiera wszystkie wypadki do przetworzenia, pomijając już przetworzone."""
    global licznik_pomietych
    zadania = []

    for folder in sorted(FOLDER_WYNIKI_TEKST.iterdir()):
        if not folder.is_dir():
            continue

        # Wyodrębnij numer wypadku
        numer = wyodrebnij_numer_wypadku(folder.name)
        if numer is None:
            continue

        # Sprawdź czy folder jest pusty
        pliki = list(folder.glob("*.txt"))
        if not pliki:
            print(f"  ⏭ Pomijam (pusty folder): {folder.name}")
            licznik_pomietych += 1
            continue

        # Sprawdź czy już przetworzono
        sciezka_wyjscia = FOLDER_REGULY / f"regula_wypadek_{numer}.json"
        if sciezka_wyjscia.exists():
            print(f"  ⏭ Pomijam (już istnieje): {folder.name}")
            licznik_pomietych += 1
            continue

        zadania.append(
            {
                "folder": folder,
                "numer": numer,
                "sciezka_wyjscia": sciezka_wyjscia,
            }
        )

    return zadania


# =============================================================================
# GŁÓWNA LOGIKA
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("GENERATOR REGUŁ EKSPERCKICH Z DOKUMENTACJI WYPADKÓW")
    print("=" * 60)
    print()

    print("=== Zbieranie wypadków do przetworzenia ===")
    zadania = zbierz_zadania()

    if not zadania:
        print("\n=== Brak nowych wypadków do przetworzenia ===")
        print(f"Pominięto: {licznik_pomietych}")
    else:
        print(
            f"\n=== Rozpoczynam przetwarzanie {len(zadania)} wypadków ({MAX_WORKERS} równolegle) ==="
        )
        print(f"Szacowany czas: ~{len(zadania) * DELAY_BETWEEN_REQUESTS // 60} minut")
        print()

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Wysyłamy zadania pojedynczo aby kontrolować rate limiting
            future_to_zadanie = {}

            for z in zadania:
                future = executor.submit(przetworz_wypadek, z)
                future_to_zadanie[future] = z

            # Odbieramy wyniki
            for future in as_completed(future_to_zadanie):
                zadanie = future_to_zadanie[future]
                try:
                    result = future.result()
                    with lock:
                        if result["status"] == "ok":
                            licznik_przetworzonych += 1
                            print(
                                f"  ✓ [{licznik_przetworzonych}/{len(zadania)}] Wypadek {result['numer']}"
                            )
                        else:
                            licznik_bledow += 1
                            print(
                                f"  ✗ Wypadek {result['numer']}: {result['error'][:100]}"
                            )
                except Exception as e:
                    with lock:
                        licznik_bledow += 1
                        print(f"  ✗ Wypadek {zadanie['numer']}: {e}")

        print()
        print("=" * 60)
        print("PODSUMOWANIE")
        print("=" * 60)
        print(f"  Przetworzonych: {licznik_przetworzonych}")
        print(f"  Pominiętych:    {licznik_pomietych}")
        print(f"  Błędów:         {licznik_bledow}")
        print(f"  Wyniki w:       {FOLDER_REGULY.absolute()}")
