import google.generativeai as genai
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

# Konfiguracja
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# Ścieżki dostosowane do struktury projektu
folder_dane = "./dane/karty wypadku - zanonimizowane"
folder_wyniki = "./wyniki_tekst"
os.makedirs(folder_wyniki, exist_ok=True)

# Limit przetwarzanych plików PDF (ustaw None aby przetworzyć wszystkie)
LIMIT_PDF = 200
# Liczba równoległych wątków
MAX_WORKERS = 3

# Thread-safe liczniki
lock = Lock()
licznik_przetworzonych = 0
licznik_pomietych = 0
licznik_bledow = 0


def przetworz_pdf(zadanie: dict) -> dict:
    """Przetwarza pojedynczy plik PDF - funkcja dla wątku."""
    sciezka_pdf = zadanie["sciezka_pdf"]
    sciezka_txt = zadanie["sciezka_txt"]
    plik = zadanie["plik"]

    result = {"plik": plik, "status": "ok", "error": None}

    uploaded_file = None
    try:
        # 1. Upload pliku
        uploaded_file = genai.upload_file(sciezka_pdf)

        # 2. Czekanie na przetworzenie
        while uploaded_file.state.name == "PROCESSING":
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)

        # 3. OCR
        response = model.generate_content(
            ["Przepisz dokładnie treść tego dokumentu.", uploaded_file]
        )

        # 4. Zapis wyniku (thread-safe dzięki osobnym plikom)
        with open(sciezka_txt, "w", encoding="utf-8") as f:
            f.write(response.text)

        result["status"] = "ok"

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
    finally:
        # 5. Sprzątanie
        if uploaded_file:
            try:
                uploaded_file.delete()
            except Exception:
                pass  # Ignorujemy błędy przy usuwaniu

    return result


def zbierz_zadania() -> list:
    """Zbiera wszystkie pliki PDF do przetworzenia."""
    global licznik_pomietych
    zadania = []

    for folder_wypadku in sorted(os.listdir(folder_dane)):
        sciezka_wypadku = os.path.join(folder_dane, folder_wypadku)

        # Pomijamy pliki (np. desktop.ini), przetwarzamy tylko foldery
        if not os.path.isdir(sciezka_wypadku):
            continue

        # Tworzymy podfolder dla wyników tego wypadku
        folder_wyniki_wypadku = os.path.join(folder_wyniki, folder_wypadku)
        os.makedirs(folder_wyniki_wypadku, exist_ok=True)

        # Iteracja przez wszystkie pliki PDF w folderze wypadku
        for plik in os.listdir(sciezka_wypadku):
            if not plik.lower().endswith(".pdf"):
                continue

            sciezka_pdf = os.path.join(sciezka_wypadku, plik)
            nazwa_txt = plik.replace(".pdf", ".txt").replace(".PDF", ".txt")
            sciezka_txt = os.path.join(folder_wyniki_wypadku, nazwa_txt)

            # Pomijamy już przetworzone pliki
            if os.path.exists(sciezka_txt):
                print(f"  ⏭ Pomijam (już istnieje): {plik}")
                licznik_pomietych += 1
                continue

            zadania.append(
                {
                    "sciezka_pdf": sciezka_pdf,
                    "sciezka_txt": sciezka_txt,
                    "plik": plik,
                    "folder": folder_wypadku,
                }
            )

            # Sprawdzamy limit
            if LIMIT_PDF is not None and len(zadania) >= LIMIT_PDF:
                print(f"\n=== Zebrano {LIMIT_PDF} plików do przetworzenia (limit) ===")
                return zadania

    return zadania


# Główna logika
print("=== Zbieranie plików do przetworzenia ===")
zadania = zbierz_zadania()

if not zadania:
    print("\n=== Brak nowych plików do przetworzenia ===")
else:
    print(
        f"\n=== Rozpoczynam przetwarzanie {len(zadania)} plików ({MAX_WORKERS} równolegle) ==="
    )

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Wysyłamy wszystkie zadania
        future_to_zadanie = {executor.submit(przetworz_pdf, z): z for z in zadania}

        # Odbieramy wyniki w miarę ich ukończenia
        for future in as_completed(future_to_zadanie):
            zadanie = future_to_zadanie[future]
            try:
                result = future.result()
                with lock:
                    if result["status"] == "ok":
                        licznik_przetworzonych += 1
                        print(
                            f"  ✓ [{licznik_przetworzonych}/{len(zadania)}] {result['plik']}"
                        )
                    else:
                        licznik_bledow += 1
                        print(f"  ✗ {result['plik']}: {result['error']}")
            except Exception as e:
                with lock:
                    licznik_bledow += 1
                    print(f"  ✗ {zadanie['plik']}: {e}")

print("\n=== Zakończono przetwarzanie ===")
print(f"  Nowo przetworzonych: {licznik_przetworzonych}")
print(f"  Pominiętych (już istniały): {licznik_pomietych}")
print(f"  Błędów: {licznik_bledow}")
print(f"Wyniki zapisane w: {folder_wyniki}")
