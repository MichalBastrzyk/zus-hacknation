# 🏛️ ZUS Asystent Wypadkowy

**Inteligentny system wspomagający orzecznictwo w sprawach wypadków przy pracy**

System wykorzystuje sztuczną inteligencję (Google Gemini) do automatycznej analizy dokumentacji wypadkowej, generowania Kart Wypadku oraz wspomagania decyzji orzeczniczych zgodnie z polskim prawem ubezpieczeń społecznych.

---

## 📋 Spis treści

- [O projekcie](#-o-projekcie)
- [Główne funkcje](#-główne-funkcje)
- [Jak doszliśmy do obecnych reguł](#-jak-doszliśmy-do-obecnych-reguł)
- [Architektura systemu](#-architektura-systemu)
- [Struktura katalogów](#-struktura-katalogów)
- [Opis ścieżek i plików](#-opis-ścieżek-i-plików)
- [Uruchomienie projektu](#-uruchomienie-projektu)
- [Technologie](#-technologie)

---

## 🎯 O projekcie

System ZUS Asystent Wypadkowy powstał w celu **automatyzacji i wspomagania procesu orzeczniczego** w sprawach wypadków przy pracy. Główne problemy, które rozwiązuje:

1. **Czasochłonna analiza dokumentacji** - system automatycznie przetwarza dokumenty (PDF, obrazy) i wyodrębnia kluczowe dane
2. **Spójność decyzji** - wykorzystanie bazy 111 historycznych precedensów zapewnia jednolite orzecznictwo
3. **Automatyczne wypełnianie Karty Wypadku** - system generuje gotowy dokument DOCX na podstawie zebranych danych
4. **Interaktywny asystent** - chatbot prowadzi użytkownika przez proces zgłaszania wypadku

---

## ✨ Główne funkcje

### 1. 💬 Chatbot Asystent
- Interaktywny asystent dostępny na stronie głównej
- Prowadzi użytkownika przez zbieranie danych do Karty Wypadku
- Pamięta kontekst rozmowy i nie pyta ponownie o podane informacje
- Grupuje pytania (max 2-3 na raz) dla lepszego UX

### 2. 📄 Analiza dokumentów GAI
- Upload plików PDF i obrazów (max 3 pliki, 5MB każdy)
- OCR i ekstrakcja danych przez Google Gemini 2.5 Flash
- Automatyczne rozpoznawanie: imion, nazwisk, dat, miejsc, opisów wypadku
- Walidacja zgodności ze schematem Karty Wypadku ZUS

### 3. ⚖️ System orzeczniczy (Decision Engine)
- Analiza 4 przesłanek wypadku przy pracy:
  - **Nagłość** - czy zdarzenie było jednorazowe?
  - **Przyczyna zewnętrzna** - czy uraz wywołał czynnik spoza organizmu?
  - **Uraz** - czy nastąpiło uszkodzenie tkanek?
  - **Związek z pracą** - czy zdarzenie miało miejsce podczas pracy?
- Weryfikacja przesłanek wyłączających (art. 21 ustawy)
- Porównanie z bazą precedensów (Case-Based Reasoning)
- Generowanie decyzji: `APPROVED` / `REJECTED` / `NEEDS_CLARIFICATION`
- Poziom pewności (confidence level) 0.0 - 1.0

### 4. 📝 Automatyczna Karta Wypadku
- Generowanie dokumentu DOCX z szablonu `wzor-karta-wypadku.docx`
- Automatyczne wypełnianie wszystkich sekcji:
  - I. Dane płatnika składek (pracodawca)
  - II. Dane poszkodowanego
  - III. Informacje o wypadku (świadkowie, kwalifikacja prawna, nietrzeźwość)
  - IV. Metadane procesowe
- Możliwość edycji przed ostatecznym zatwierdzeniem
- Eksport do formatu DOCX (z możliwością dalszej edycji)

### 5. 📊 Rejestr analiz
- Tabela z historią wszystkich zgłoszeń
- Szczegółowy podgląd każdej analizy

---

## 🧠 Jak doszliśmy do obecnych reguł

Baza reguł (`rules_database_min.json`) powstała w procesie **3-etapowym**:

### Etap 1: OCR dokumentacji (`scripts/skrypt-ocr.py`)
- Przetworzenie **200 anonimowych kart wypadków** z archiwum ZUS
- Wykorzystanie Gemini 2.5 Flash do OCR plików PDF
- Równoległe przetwarzanie (3 wątki) z obsługą rate-limitingu
- Wyniki zapisane w folderze `./wyniki_tekst/`

### Etap 2: Ekstrakcja reguł (`scripts/skrypt-reguly.py`)
- Analiza 4 typów dokumentów dla każdego wypadku:
  - Karta wypadku
  - Opinia prawna
  - Wyjaśnienia poszkodowanego
  - Zawiadomienie o wypadku
- Generowanie strukturalnych reguł eksperckich w formacie JSON
- Walidacja schematem Pydantic (typy, enumy, wymagane pola)
- Każda reguła zawiera:
  - **Metadane** (data, godzina, miejsce, rodzaj urazu)
  - **Analiza decyzji** (status UZNANY/NIEUZNANY, powód, cytat prawny)
  - **Fakty kluczowe** (lista najważniejszych faktów)
  - **Reguła ekspercka** (warunek, logika IF-THEN, kategoria problemu)
  - **Wnioski dla bota** (wskazówki, ryzyko odrzucenia)

### Etap 3: Konsolidacja (`scripts/skrypt-polacz-reguly.py`)
- Połączenie wszystkich reguł w jeden plik `rules_database.json`
- Możliwość wykluczenia wadliwych przypadków (lista `WYKLUCZONE`)
- Generowanie statystyk:
  - Liczba reguł uznanych/nieuznanych
  - Rozkład kategorii problemów prawnych
  - Rozkład ryzyka odrzucenia
- Zminimalizowana wersja `rules_database_min.json` używana przez API

### Kategorie problemów prawnych w bazie:
| Kategoria              | Opis                                              |
| ---------------------- | ------------------------------------------------- |
| `PRZYCZYNA_ZEWNETRZNA` | Brak zewnętrznego czynnika (np. zawał bez stresu) |
| `NAGLOSC`              | Brak nagłości (np. choroba zawodowa vs wypadek)   |
| `ZWIAZEK_Z_PRACA`      | Brak związku z obowiązkami służbowymi             |
| `STAN_NIETRZEZWOSCI`   | Poszkodowany pod wpływem alkoholu/narkotyków      |
| `INNE`                 | Pozostałe przypadki                               |

---

## 🏗️ Architektura systemu

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Strona      │  │ Upload       │  │ Rejestr analiz        │  │
│  │ główna +    │  │ dokumentów   │  │ /cases                │  │
│  │ Chatbot     │  │ /cases/upload│  │ /cases/[id]           │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API ROUTES                              │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ /api/chat   │  │ /api/analyze │  │ Server Actions        │  │
│  │ Konwersacja │  │ Analiza      │  │ submit-case           │  │
│  │ z asystentem│  │ dokumentów   │  │ export-karta-wypadku  │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AI / GEMINI 2.5 FLASH                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • OCR dokumentów                                        │   │
│  │ • Ekstrakcja danych (AccidentCardSchema)                │   │
│  │ • Analiza orzecznicza (AccidentDecisionSchema)          │   │
│  │ • Porównanie z bazą precedensów (111 reguł)             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BAZA DANYCH                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ SQLite (Turso/LibSQL) + Drizzle ORM                     │   │
│  │ Tabele: employers, injuredPersons, accidents,           │   │
│  │         analysis, witnesses                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Struktura katalogów

```
zus-hacknation/
├── scripts/                    # Skrypty do budowania bazy reguł
│   ├── skrypt-ocr.py           # OCR dokumentów PDF (Etap 1)
│   ├── skrypt-reguly.py        # Ekstrakcja reguł (Etap 2)
│   └── skrypt-polacz-reguly.py # Konsolidacja reguł (Etap 3)
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Strona główna z chatbotem
│   │   ├── layout.tsx          # Layout aplikacji
│   │   ├── globals.css         # Style globalne (Tailwind)
│   │   │
│   │   ├── actions/            # Server Actions
│   │   │   ├── submit-case.ts  # Zapis zgłoszenia do bazy
│   │   │   └── export-karta-wypadku.ts # Generowanie DOCX
│   │   │
│   │   ├── api/                # API Routes
│   │   │   ├── analyze/route.ts    # Analiza dokumentów
│   │   │   └── chat/route.ts       # Konwersacja z chatbotem
│   │   │
│   │   └── cases/              # Moduł rejestru spraw
│   │       ├── page.tsx        # Lista wszystkich analiz
│   │       ├── upload/page.tsx # Upload i analiza dokumentów
│   │       ├── [id]/page.tsx   # Szczegóły pojedynczej analizy
│   │       └── _components/    # Komponenty tabeli
│   │
│   ├── components/             # Komponenty React
│   │   ├── AccidentChat.tsx    # Główny chatbot
│   │   ├── AnalysisResult.tsx  # Wyświetlanie wyniku analizy
│   │   ├── data-table/         # Komponenty tabeli danych
│   │   └── ui/                 # shadcn/ui komponenty
│   │
│   ├── db/                     # Baza danych
│   │   ├── index.ts            # Połączenie z bazą
│   │   └── schema.ts           # Schemat Drizzle ORM
│   │
│   ├── lib/                    # Biblioteki pomocnicze
│   │   ├── extractors.ts       # AccidentCardSchema (Zod)
│   │   ├── validators.ts       # AccidentDecisionSchema (Zod)
│   │   ├── format.ts           # Formatowanie dat, liczb
│   │   ├── parsers.ts          # Parsery danych
│   │   └── utils.ts            # Funkcje pomocnicze
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── use-data-table.ts   # Hook dla tabeli danych
│   │   └── use-mobile.ts       # Wykrywanie urządzeń mobilnych
│   │
│   └── types/                  # Definicje TypeScript
│       └── data-table.ts       # Typy dla tabeli
│
├── public/
│   └── zus.html                # Strona informacyjna ZUS
│
├── rules_database_min.json     # Baza 111 precedensów (zminimalizowana)
├── wzor-karta-wypadku.docx     # Szablon Karty Wypadku
├── drizzle.config.ts           # Konfiguracja Drizzle ORM
├── package.json                # Zależności projektu
└── README.md                   # Ten plik
```

---

## 📖 Opis ścieżek i plików

### Skrypty (`scripts/`)

| Plik                      | Opis                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skrypt-ocr.py`           | Przeprowadza OCR na plikach PDF z zanonimizowanych kart wypadku. Używa Gemini do przepisania treści dokumentów. Obsługuje równoległe przetwarzanie (3 wątki) i pomija już przetworzone pliki. |
| `skrypt-reguly.py`        | Analizuje przetworzone dokumenty i generuje reguły eksperckie. Dla każdego wypadku szuka 4 typów dokumentów, buduje prompt dla AI i waliduje odpowiedź schematem Pydantic.                    |
| `skrypt-polacz-reguly.py` | Łączy wszystkie reguły w jeden plik JSON. Pozwala wykluczyć wadliwe przypadki. Generuje statystyki (uznane/nieuznane, kategorie, ryzyko).                                                     |

### Strony aplikacji (`src/app/`)

| Ścieżka         | Komponent               | Opis                                                         |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| `/`             | `page.tsx`              | Strona główna z osadzonym iframe ZUS i pływającym chatbotem  |
| `/cases`        | `cases/page.tsx`        | Rejestr wszystkich analiz wypadków w formie tabeli           |
| `/cases/upload` | `cases/upload/page.tsx` | Formularz uploadu dokumentów + ręczny opis tekstowy          |
| `/cases/[id]`   | `cases/[id]/page.tsx`   | Szczegółowy widok pojedynczej analizy z danymi Karty Wypadku |

### API Routes (`src/app/api/`)

| Endpoint       | Metoda | Opis                                                                                                                 |
| -------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `/api/chat`    | POST   | Prowadzi konwersację z chatbotem. Przyjmuje historię wiadomości, zwraca odpowiedź asystenta + listę brakujących pól. |
| `/api/analyze` | POST   | Analizuje przesłane pliki (PDF/obrazy). Zwraca decyzję orzeczniczą + dane do Karty Wypadku.                          |

### Server Actions (`src/app/actions/`)

| Plik                      | Funkcja                   | Opis                                                                                              |
| ------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `submit-case.ts`          | `submitCase()`            | Zapisuje analizę do bazy danych. Normalizuje daty, wyodrębnia dane z transkryptu rozmowy.         |
| `export-karta-wypadku.ts` | `exportKartaWypadkuUrl()` | Generuje dokument DOCX z szablonu. Wypełnia wszystkie pola danymi z bazy. Zwraca URL do pobrania. |

### Komponenty (`src/components/`)

| Komponent            | Opis                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `AccidentChat.tsx`   | Pływający chatbot. Obsługuje konwersację, wyświetla brakujące pola, umożliwia analizę i zapis. |
| `AnalysisResult.tsx` | Wyświetla wynik analizy: decyzję, kryteria, wady, referencje do precedensów.                   |
| `data-table/*.tsx`   | Zaawansowana tabela z filtrowaniem, sortowaniem, paginacją (TanStack Table).                   |
| `ui/*.tsx`           | Biblioteka komponentów shadcn/ui (Button, Card, Dialog, Form, Table, itp.).                    |

### Schematy danych (`src/lib/`)

| Plik            | Schema                   | Opis                                                                                                    |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `extractors.ts` | `AccidentCardSchema`     | Pełny schemat Karty Wypadku ZUS (pracodawca, poszkodowany, wypadek, świadkowie, nietrzeźwość, metadane) |
| `validators.ts` | `AccidentDecisionSchema` | Schemat decyzji orzeczniczej (decyzja, ekstrakcja danych, kryteria, wady, referencje)                   |

### Baza danych (`src/db/`)

| Tabela           | Opis                                                          |
| ---------------- | ------------------------------------------------------------- |
| `employers`      | Dane pracodawców (NIP, nazwa, adres)                          |
| `injuredPersons` | Dane poszkodowanych (PESEL, imię, nazwisko, adres)            |
| `accidents`      | Informacje o wypadkach (typ, dotkliwość, data, miejsce, opis) |
| `analysis`       | Wyniki analizy AI (decyzja, kryteria, wady, Karta Wypadku)    |
| `witnesses`      | Świadkowie wypadków                                           |

---

## 🚀 Uruchomienie projektu

### Projekt jest dostępny pod adresem:

[zus-hacknation.vercel.app](https://zus-hacknation.vercel.app/)

### Wymagania
- Node.js 22+
- Bun (opcjonalnie, alternatywa dla npm)
- Konto Google Cloud z włączonym API Gemini
- Baza Turso

### Instalacja

```bash
# Klonowanie repozytorium
git clone https://github.com/MichalBastrzyk/zus-hacknation.git
cd zus-hacknation

# Instalacja zależności
bun install

# Konfiguracja zmiennych środowiskowych
cp .env.example .env.local
# Uzupełnij GEMINI_API_KEY i DATABASE_URL

# Migracja bazy danych
bunx drizzle-kit push

# Uruchomienie serwera deweloperskiego
bun dev
```

Aplikacja dostępna pod adresem: [http://localhost:3000](http://localhost:3000)

### Drizzle Studio (podgląd bazy)

```bash
bunx drizzle-kit studio
```

---

## 🛠️ Technologie

| Kategoria        | Technologia              |
| ---------------- | ------------------------ |
| Framework        | Next.js 16 (App Router)  |
| Język            | TypeScript               |
| AI/LLM           | Google Gemini 2.5 Flash  |
| Baza danych      | SQLite (Turso/LibSQL)    |
| ORM              | Drizzle ORM              |
| UI               | Tailwind CSS + shadcn/ui |
| Tabele           | TanStack Table v8        |
| Walidacja        | Zod                      |
| Generowanie DOCX | docxtemplater + PizZip   |
| Stan URL         | nuqs                     |

---

## 👥 Autorzy

- Michał Bastrzyk
- Zuzanna Żelazana
- Igor Gibas
- Tomasz Krawczyk
- Maks Bator
