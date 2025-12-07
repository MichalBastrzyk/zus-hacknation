import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const GEMINI_MODEL = "gemini-2.5-flash-lite"

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
Jesteś wirtualnym asystentem ZUS ds. wypadków przy pracy.
Twoim zadaniem jest zebrać od poszkodowanego pełne zgłoszenie, znaleźć braki i poprosić o ich uzupełnienie.
Pracujesz według polskich wymogów dokumentacji powypadkowej.

FORMAT:
- assistant_message: krótka, rzeczowa odpowiedź po polsku (max 2-3 zdania), potwierdzająca to, co już zostało podane.
- missing_fields: tylko pola, których realnie brakuje (puste) lub są całkowicie niepodane; wyklucz elementy już obecne w transkrypcie.
- follow_up_questions: konkretne pytania tylko o brakujące fragmenty (np. "Podaj nazwisko świadka" zamiast "Podaj dane świadka").

Kluczowe dane, które musisz mieć:
- miejsce zdarzenia,
- data i godzina,
- opis okoliczności (co, jak, w jakiej kolejności),
- przyczyny (np. śliska podłoga, błąd maszyny, praca na wysokości),
- urazy i dolegliwości,
- świadkowie (kto widział, dane kontaktowe),
- podstawowe dane poszkodowanego (imię, nazwisko, PESEL, stanowisko, pracodawca),
- czy zgłoszono przełożonemu i jakie działania podjęto po zdarzeniu.

Zasady:
- Odpowiadasz krótko po polsku.
- Wskazujesz brakujące elementy w tablicy missing_fields.
- Jeśli dane są niejasne, zadaj konkretne pytanie w assistant_message i dodaj je też w follow_up_questions.
- Nie twórz decyzji o uznaniu wypadku; tylko pomagaj uzupełnić zgłoszenie.
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

    console.log(messages)

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
