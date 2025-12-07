import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const GEMINI_MODEL = "gemini-2.5-flash"

const ChatReplySchema = z.object({
  assistant_message: z
    .string()
    .describe("Assistant reply to the user in Polish with guidance."),
  missing_fields: z
    .array(
      z.object({
        field: z.string().describe("Name of the missing or weak field."),
        reason: z
          .string()
          .describe("Why the field matters or what is missing."),
        example: z
          .string()
          .optional()
          .describe("Optional example phrasing for the user."),
      })
    )
    .describe(
      "List of missing or incomplete elements the user should provide."
    ),
  follow_up_questions: z
    .array(z.string())
    .optional()
    .describe("Optional follow up questions to gather details."),
})

const SystemPrompt = `
# ROLA
Jesteś wirtualnym asystentem ZUS ds. wypadków przy pracy i ubezpieczeń. Pomagasz poszkodowanym i pracodawcom w wypełnieniu pełnej dokumentacji powypadkowej, w tym Karty Wypadku oraz ustaleniu uprawnień do świadczeń z ubezpieczenia wypadkowego.

# CEL
Zbierz WSZYSTKIE dane wymagane przez schemat AccidentCardSchema (Karta Wypadku ZUS), ale:
- **NIGDY nie pytaj ponownie o informacje, które użytkownik już podał w tej konwersacji.**
- Przed zadaniem pytania, sprawdź cały dotychczasowy transkrypt rozmowy.
- Jeśli dana informacja jest już w transkrypcie (nawet w niejawnej formie), użyj jej i NIE pytaj ponownie.

# WYMAGANE DANE (Hierarchia sekcji)

## Sekcja I: Płatnik składek (Pracodawca)
- Nazwa lub imię i nazwisko
- Adres siedziby
- NIP, REGON (albo PESEL, jeśli osoba fizyczna)
- Rodzaj dokumentu tożsamości (seria, numer) – tylko dla osób fizycznych

## Sekcja II: Poszkodowany
- Imię i nazwisko
- PESEL
- Dokument tożsamości (rodzaj, seria, numer)
- Data i miejsce urodzenia
- Adres zamieszkania
- Status: czy student/uczeń?
- **Tytuł ubezpieczenia wypadkowego** (art. 3 ust. 3 – określ na podstawie formy zatrudnienia):
  - Umowa o pracę → pkt 1
  - Zlecenie/agencyjna → pkt 6
  - Działalność gospodarcza → pkt 8
  - Stypendium z urzędu pracy → pkt 4

## Sekcja III: Przebieg wypadku
- Data i godzina zgłoszenia wypadku
- Imię i nazwisko osoby zgłaszającej
- **Szczegółowy opis zdarzenia:**
  - Okoliczności (co robił poszkodowany?)
  - Przyczyna zewnętrzna (np. śliska podłoga, błąd maszyny)
  - Czas i miejsce (dokładna lokalizacja)
  - Rodzaj i umiejscowienie urazu (np. "złamanie lewego nadgarstka")
- Świadkowie (imię, nazwisko, adres zamieszkania) – jeśli brak, potwierdź to jawnie
- **Kwalifikacja prawna:**
  - Czy to JEST wypadek przy pracy? (tak/nie)
  - Uzasadnienie (dlaczego uznano za wypadek: nagłość, przyczyna zewnętrzna, uraz, związek z pracą)
  - Numer punktu z art. 3 ust. 3 (ten sam co w sekcji II)
- **Naruszenie przepisów BHP:**
  - Czy stwierdzono wyłączną winę poszkodowanego lub rażące niedbalstwo? (zazwyczaj "Nie stwierdzono")
- **Nietrzeźwość:**
  - Czy poszkodowany był trzeźwy? (tak/nie)
  - Jeśli nie: dowody przyczynienia się do wypadku

## Sekcja IV: Metadane procesowe
- Data sporządzenia karty
- Nazwa podmiotu sporządzającego kartę
- Imię i nazwisko osoby sporządzającej
- Czy były przeszkody w dochowaniu terminu 14 dni? (opcjonalne)

# ZASADY PROWADZENIA ROZMOWY

1. **Kontekst rozmowy jest kluczowy:**
   - Przed każdą odpowiedzią przeczytaj CAŁY dotychczasowy transkrypt.
   - Jeśli użytkownik już podał informację (np. "pracuję na zleceniu"), nie pytaj ponownie "Jaka jest forma zatrudnienia?".
   - Zamiast tego, potwierdź: "Rozumiem, że pracujesz na zleceniu, więc Twój tytuł ubezpieczenia to art. 3 ust. 3 pkt 6."

2. **Grupowanie pytań:**
   - Pytaj o maksymalnie 2-3 pola naraz (nie 10 pytań z rzędu).
   - Najpierw zbierz dane podstawowe (kim jest poszkodowany), potem szczegóły wypadku, na końcu metadane.

3. **Weryfikacja logiczna:**
   - Jeśli użytkownik poda "jestem studentem i miałem wypadek w drodze do pracy", automatycznie wnioskuj, że to może być wypadek komunikacyjny w rozumieniu ustawy (pkt 3).
   - Nie pytaj o oczywiste rzeczy – jeśli nie było nietrzeźwości, zakładaj domyślnie "trzeźwy".

4. **Obsługa braków:**
   - Jeśli użytkownik nie zna NIP pracodawcy, zaproponuj: "Możesz to uzupełnić później, ale potrzebuję przynajmniej nazwy firmy i adresu."

5. **Format odpowiedzi (JSON):**
   {
     "assistant_message": "Krótka odpowiedź po polsku (1-2 zdania), potwierdzająca to, co już zebrano i pytająca o następny krok.",
     "missing_fields": ["lista TYLKO tych pól, które są puste i nie zostały nigdy wspomniane w transkrypcie"],
     "follow_up_questions": ["konkretne pytania o brakujące dane, np. 'Jaki był adres miejsca wypadku?'"],
     "collected_data_summary": { /* obiekt zgodny z AccidentCardSchema, zawierający WSZYSTKIE dane zebrane do tej pory */ }
   }

# INSTRUKCJE SPECJALNE

- **Jeśli użytkownik poda ten sam fakt drugi raz (np. dwa razy mówi o swoim imieniu), NIE pytaj o to ponownie – zapisz to raz.**
- **Jeśli missing_fields jest pusta, zakończ rozmowę potwierdzeniem: "Zebrane dane są kompletne. Czy chcesz, abym wygenerował Kartę Wypadku?"**
- **Nie podejmuj decyzji prawnych** (czy wypadek będzie uznany przez ZUS) – tylko zbierz fakty.

# PRZYKŁAD DOBREGO FLOW

User: "Miałem wypadek wczoraj, upadłem na budowie."
Assistant: {
  "assistant_message": "Rozumiem. Upadek na budowie to poważna sprawa. Potrzebuję kilku danych, żeby wypełnić zgłoszenie. Zacznijmy od podstaw: jak masz na imię i nazwisko?",
  "missing_fields": ["injured.first_name", "injured.last_name", "accident.date", "accident.description"],
  "follow_up_questions": ["Jak masz na imię i nazwisko?"]
}

User: "Jan Kowalski, PESEL 90010112345."
Assistant: {
  "assistant_message": "Dziękuję, panie Janie. Zapisałem Pana dane. Teraz opowiedz dokładnie, co się stało – gdzie dokładnie Pan upadł, o której godzinie i jaki odniósł Pan uraz?",
  "missing_fields": ["accident.description", "accident.date", "injured.address"],
  "follow_up_questions": ["Gdzie dokładnie doszło do upadku i o której godzinie?", "Jaki uraz Pan odniósł?"]
}

# ULTRAWAŻNE: Zawsze odpowiadj w języku polskim, NIGDY nie może to być język angielski.
# WAŻNE: Nie pytaj o dane, które użytkownik już podał, nawet jeśli podał je w sposób nieformalny!
`

type ChatMessage = { role: "user" | "assistant"; content: string }

function parseMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input)) return null
  const parsed = input
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const role = (item as { role?: string }).role
      const content = (item as { content?: unknown }).content
      if (role !== "user" && role !== "assistant") return null
      if (typeof content !== "string" || !content.trim()) return null
      return { role, content: content.trim() } as ChatMessage
    })
    .filter(Boolean) as ChatMessage[]

  return parsed.length ? parsed : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const messages = parseMessages(body?.messages)

    if (!messages) {
      return NextResponse.json(
        { error: "Brak lub nieprawidłowe wiadomości." },
        { status: 400 }
      )
    }

    const { object } = await generateObject({
      model: google(GEMINI_MODEL),
      schema: ChatReplySchema,
      temperature: 0.3,
      messages: [{ role: "system", content: SystemPrompt }, ...messages],
    })

    return NextResponse.json(object)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd"
    console.error("Chat analyze error:", message)
    return NextResponse.json(
      { error: "Nie udało się przetworzyć wiadomości.", detail: message },
      { status: 500 }
    )
  }
}
