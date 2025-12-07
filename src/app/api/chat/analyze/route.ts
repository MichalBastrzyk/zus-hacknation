import { readFile } from "fs/promises"
import path from "path"
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { AccidentDecisionSchema } from "@/lib/validators"

const GEMINI_MODEL = "gemini-2.5-flash-lite"

type ChatMessage = { role: "user" | "assistant"; content: string }

type BodyShape = { messages?: unknown }

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

const SYSTEM_PROMPT = `
Jesteś Eksperckim Systemem Orzeczniczym ZUS (ZUS Adjudication Engine v2.0).
Oceń szanse uznania wypadku wyłącznie na podstawie rozmowy (brak plików).
Wynik strukturyzuj według podanego schematu JSON (AccidentDecisionSchema).

KRYTYCZNE - EKSTRAKCJA DANYCH:
Przed analizą musisz wyodrębnić z rozmowy następujące dane i umieścić je w polu "extracted_data":
- injured_first_name: Imię poszkodowanego
- injured_last_name: Nazwisko poszkodowanego  
- employer_name: Nazwa pracodawcy/zakładu pracy
- position: Stanowisko poszkodowanego
- accident_date: Data wypadku (format YYYY-MM-DD)
- accident_place: Miejsce wypadku
- accident_description: Krótki opis przebiegu wypadku
- accident_cause: Przyczyna wypadku

Jak ekstrahować:
- Przeszukaj całą treść rozmowy (także pojedyncze zdania bez etykiet) i kopiuj oryginalne brzmienie bez parafraz.
- Jeśli znalazłeś tylko częściową informację, zwróć najlepszy fragment; jeśli nic nie ma, ustaw null (nie halucynuj).
` as const

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as BodyShape | null
    const messages = parseMessages(body?.messages)

    console.log(messages)

    if (!messages) {
      return NextResponse.json(
        { error: "Brak lub nieprawidłowe wiadomości." },
        { status: 400 }
      )
    }

    const rulesPath = path.join(process.cwd(), "rules_database_min.json")
    const rulesRaw = await readFile(rulesPath, "utf-8").catch(() => "")

    const transcript = messages
      .map(
        (m) => `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${m.content}`
      )
      .join("\n")

    const { object } = await generateObject({
      model: google(GEMINI_MODEL),
      schema: AccidentDecisionSchema,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `REGULY_JSON:\n${rulesRaw}\nKONIEC_REGUL_JSON\nTRANSKRYPT:\n${transcript}`,
        },
      ],
    })

    return NextResponse.json(object)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd"
    return NextResponse.json(
      { error: "Nie udało się przeprowadzić analizy.", detail: message },
      { status: 500 }
    )
  }
}
