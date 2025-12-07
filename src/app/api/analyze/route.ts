import { readFile } from "fs/promises"
import path from "path"
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { AccidentCardSchema } from "@/lib/extractors"
import { AccidentDecisionSchema } from "@/lib/validators"

const GEMINI_MODEL = "gemini-2.5-flash"

const ACCIDENT_CARD_PROMPT = `
Wyodrębnij komplet danych wymaganych do sporządzenia Karty Wypadku przy pracy.
Zwróć dane w formacie JSON zgodnym ze schematem AccidentCardSchema.
- Jeśli jakiejś informacji brak w dokumentach, wpisz pusty string lub krótki opis "brak danych" (zawsze string).
- Nie parafrazuj tego, co jest dostępne – kopiuj oryginalne brzmienie.
`

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const files = formData
      .getAll("files")
      .filter((item): item is File => item instanceof File)

    if (!files.length) {
      return NextResponse.json(
        { error: "Do analizy wymagane są pliki (PDF lub obrazy)." },
        { status: 400 }
      )
    }

    const rulesPath = path.join(process.cwd(), "rules_database_min.json")
    const rulesRaw = await readFile(rulesPath, "utf-8")

    const fileParts = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        return {
          type: "file" as const,
          data: buffer,
          mediaType: file.type || "application/octet-stream",
          name: file.name,
        }
      })
    )

    const prompt = `
Jesteś Eksperckim Systemem Orzeczniczym ZUS (ZUS Adjudication Engine v2.0).
Twoim celem jest naśladowanie procesu decyzyjnego doświadczonego orzecznika w sprawach wypadków przy pracy.

TWOJE ŹRÓDŁO PRAWDY:
Opierasz się WYŁĄCZNIE na dostarczonej "Bazie Reguł" (111 spraw historycznych) oraz poniższych definicjach prawnych. Nie wolno Ci wydawać decyzji sprzecznych z tymi źródłami.

KRYTYCZNE - EKSTRAKCJA DANYCH:
Przed analizą musisz wyodrębnić z dokumentu następujące dane i umieścić je w polu "extracted_data":
- injured_first_name: Imię poszkodowanego
- injured_last_name: Nazwisko poszkodowanego  
- employer_name: Nazwa pracodawcy/zakładu pracy
- position: Stanowisko poszkodowanego
- accident_date: Data wypadku (format YYYY-MM-DD)
- accident_place: Miejsce wypadku
- accident_description: Krótki opis przebiegu wypadku
- accident_cause: Przyczyna wypadku

Jak ekstrahować:
- Przeszukaj cały tekst (także tabele/nagłówki) pod kątem etykiet i surowych fragmentów.
- Kopiuj oryginalne brzmienie (bez parafrazowania). Jeśli brak pewności co do wartości, zwróć najlepszy znaleziony fragment.
- Jeśli w dokumencie nie ma danej informacji, ustaw wartość na null (nie halucynuj).

ALGORYTM ANALIZY (Chain of Thought):
Zanim wydasz werdykt, musisz przejść przez następujące kroki myślowe:

KROK 1: WERYFIKACJA DEFINICJI WYPADKU (Art. 3 ustawy wypadkowej)
Sprawdź, czy zdarzenie spełnia ŁĄCZNIE 4 przesłanki:
A. NAGŁOŚĆ: Czy zdarzenie było jednorazowe i krótkotrwałe? (np. dźwignięcie vs. wieloletnie przeciążenie).
B. PRZYCZYNA ZEWNĘTRZNA:
   - Czy uraz wywołał czynnik spoza organizmu (maszyna, śliska podłoga, uderzenie)?
   - UWAGA: Zawał serca, udar lub ból kręgosłupa przy "zwykłym wstawaniu" to zazwyczaj przyczyna WEWNĘTRZNA (odmowa), CHYBA ŻE wywołał je nadzwyczajny stres lub wysiłek w pracy.
C. URAZ: Czy nastąpiło uszkodzenie tkanek (np. złamanie, rana)? "Ból" bez urazu nie jest wypadkiem.
D. ZWIĄZEK Z PRACĄ: Czy do zdarzenia doszło:
   - Podczas wykonywania zwykłych czynności lub poleceń przełożonego?
   - W drodze między siedzibą a miejscem wykonywania zadania?
   - KRYTYCZNE: Jeśli zdarzenie miało miejsce podczas "prywatnej przerwy na papierosa" poza terenem zakładu lub podczas samowolnego oddalenia się – oznacz to jako ryzyko odmowy.

KROK 2: ANALIZA NEGATYWNA (Przesłanki wyłączające)
Sprawdź, czy zachodzą okoliczności z art. 21 ustawy:
A. UMYSŁNOŚĆ lub RAŻĄCE NIEDBALSTWO:
   - Zwykła nieostrożność (np. pośpiech) NIE JEST rażącym niedbalstwem – to nadal wypadek przy pracy.
   - Rażące niedbalstwo to granica umyślności (np. praca na dachu bez szelek mimo upomnień).
B. NIETRZEŹWOŚĆ: Czy są przesłanki wskazujące na alkohol/narkotyki?

KROK 3: PORÓWNANIE Z BAZĄ (Case-Based Reasoning)
- Znajdź w bazie sprawę o identycznym mechanizmie.
- Jeśli w bazie "poślizgnięcie na schodach" było UZNANE, Ty też musisz to UZNAĆ, chyba że w nowej sprawie poszkodowany był pijany.

ZASADY PUNKTACJI ZAUFANIA (0.0 - 1.0):
- 1.0: Sprawa bliźniacza do uznanego precedensu.
- < 0.5: Brak przyczyny zewnętrznej (np. "szedłem i zabolała mnie noga") lub podejrzenie czynności prywatnej.

FORMAT ODPOWIEDZI:
Zawsze odpowiadaj w języku polskim. Nigdy nie może to być język angielski.
Wygeneruj odpowiedź wyłącznie w formacie JSON zgodnym z dostarczonym schematem (AccidentDecisionSchema).
    `
    const { object: decision } = await generateObject({
      model: google(GEMINI_MODEL),
      schema: AccidentDecisionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "text",
              text: `REGULY_JSON:\n${rulesRaw}\nKONIEC_REGUL_JSON`,
            },
            ...fileParts,
          ],
        },
      ],
      temperature: 0.2,
    })

    const { object: accidentCard } = await generateObject({
      model: google(GEMINI_MODEL),
      schema: AccidentCardSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ACCIDENT_CARD_PROMPT },
            {
              type: "text",
              text: `REGULY_JSON:\n${rulesRaw}\nKONIEC_REGUL_JSON`,
            },
            ...fileParts,
          ],
        },
      ],
      temperature: 0.2,
    })

    return NextResponse.json({ ...decision, accidentCard })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd"
    return NextResponse.json(
      { error: "Nie udało się przetworzyć żądania", detail: message },
      { status: 500 }
    )
  }
}
