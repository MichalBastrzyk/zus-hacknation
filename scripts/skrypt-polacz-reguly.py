#!/usr/bin/env python3
"""
Skrypt do łączenia wszystkich reguł w jeden plik rules_database.json.
Umożliwia wykluczenie wybranych wypadków z bazy.
"""

import json
import re
from pathlib import Path
from typing import Optional

# =============================================================================
# KONFIGURACJA
# =============================================================================

FOLDER_REGULY = Path("./reguly")
PLIK_WYJSCIOWY = Path("./rules_database.json")

# =============================================================================
# LISTA WYKLUCZEŃ - EDYTUJ TĘ LISTĘ ABY USUNĄĆ WYBRANE WYPADKI
# =============================================================================
# Wpisz numery wypadków które chcesz wykluczyć z bazy reguł.
# Przykład: WYKLUCZONE = [5, 23, 45, 67]
# Pusta lista = wszystkie reguły zostaną włączone

WYKLUCZONE: list[int] = [
    # Tutaj wpisz numery wypadków do wykluczenia, np:
    # 5,
    # 23,
    # 45,
]

# =============================================================================
# FUNKCJE
# =============================================================================


def wyodrebnij_numer(nazwa_pliku: str) -> Optional[int]:
    """Wyodrębnia numer wypadku z nazwy pliku."""
    match = re.search(r"wypadek_(\d+)", nazwa_pliku)
    if match:
        return int(match.group(1))
    return None


def wczytaj_reguly() -> list[dict]:
    """Wczytuje wszystkie reguły z folderu, pomijając wykluczone."""
    reguly = []
    pominięte = []
    błędy = []

    # Pobierz wszystkie pliki JSON
    pliki = sorted(
        FOLDER_REGULY.glob("regula_wypadek_*.json"),
        key=lambda p: wyodrebnij_numer(p.name) or 0,
    )

    for plik in pliki:
        numer = wyodrebnij_numer(plik.name)

        if numer is None:
            print(f"  ⚠ Nie można odczytać numeru: {plik.name}")
            continue

        # Sprawdź czy wykluczony
        if numer in WYKLUCZONE:
            pominięte.append(numer)
            print(f"  ⏭ Pomijam (wykluczone): wypadek {numer}")
            continue

        # Wczytaj plik
        try:
            with open(plik, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Dodaj identyfikator wypadku do danych
            data["_id_wypadku"] = numer
            data["_plik_zrodlowy"] = plik.name

            reguly.append(data)

        except json.JSONDecodeError as e:
            błędy.append((numer, str(e)))
            print(f"  ✗ Błąd JSON w wypadku {numer}: {e}")
        except Exception as e:
            błędy.append((numer, str(e)))
            print(f"  ✗ Błąd odczytu wypadku {numer}: {e}")

    return reguly, pominięte, błędy


def generuj_statystyki(reguly: list[dict]) -> dict:
    """Generuje statystyki z bazy reguł."""
    stats = {
        "liczba_regul": len(reguly),
        "uznane": 0,
        "nieuznane": 0,
        "kategorie": {},
        "ryzyko": {"NISKIE": 0, "SREDNIE": 0, "WYSOKIE": 0},
    }

    for r in reguly:
        # Status
        status = r.get("analiza_decyzji", {}).get("status", "")
        if status == "UZNANY":
            stats["uznane"] += 1
        elif status == "NIEUZNANY":
            stats["nieuznane"] += 1

        # Kategoria problemu
        kategoria = r.get("regula_ekspercka", {}).get("kategoria_problemu", "NIEZNANA")
        stats["kategorie"][kategoria] = stats["kategorie"].get(kategoria, 0) + 1

        # Ryzyko
        ryzyko = r.get("wnioski_dla_bota", {}).get("ryzyko_odrzucenia", "")
        if ryzyko in stats["ryzyko"]:
            stats["ryzyko"][ryzyko] += 1

    return stats


def zapisz_baze(reguly: list[dict], stats: dict):
    """Zapisuje bazę reguł do pliku JSON."""
    baza = {
        "_metadata": {
            "wersja": "1.0",
            "liczba_regul": len(reguly),
            "wykluczone_wypadki": WYKLUCZONE,
            "statystyki": stats,
        },
        "reguly": reguly,
    }

    with open(PLIK_WYJSCIOWY, "w", encoding="utf-8") as f:
        json.dump(baza, f, ensure_ascii=False, indent=2)


# =============================================================================
# GŁÓWNA LOGIKA
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ŁĄCZENIE REGUŁ W BAZĘ DANYCH")
    print("=" * 60)
    print()

    if WYKLUCZONE:
        print(f"⚠ Wykluczono {len(WYKLUCZONE)} wypadków: {WYKLUCZONE}")
        print()

    print("=== Wczytywanie reguł ===")
    reguly, pominięte, błędy = wczytaj_reguly()

    if not reguly:
        print("\n✗ Nie znaleziono żadnych reguł do połączenia!")
        exit(1)

    print(f"\n=== Generowanie statystyk ===")
    stats = generuj_statystyki(reguly)

    print(f"\n=== Zapisywanie bazy ===")
    zapisz_baze(reguly, stats)

    print()
    print("=" * 60)
    print("PODSUMOWANIE")
    print("=" * 60)
    print(f"  Wczytanych reguł:    {len(reguly)}")
    print(f"  Wykluczonych:        {len(pominięte)}")
    print(f"  Błędów:              {len(błędy)}")
    print()
    print("  STATYSTYKI BAZY:")
    print(f"    Uznane:            {stats['uznane']}")
    print(f"    Nieuznane:         {stats['nieuznane']}")
    print()
    print("  KATEGORIE PROBLEMÓW:")
    for kat, liczba in sorted(stats["kategorie"].items(), key=lambda x: -x[1]):
        print(f"    {kat}: {liczba}")
    print()
    print("  RYZYKO ODRZUCENIA:")
    for ryz, liczba in stats["ryzyko"].items():
        print(f"    {ryz}: {liczba}")
    print()
    print(f"  Zapisano do: {PLIK_WYJSCIOWY.absolute()}")
