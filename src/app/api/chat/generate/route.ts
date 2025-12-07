import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

const GEMINI_MODEL = "gemini-2.5-flash"

const ApplicationSchema = z.object({
  application: z
    .string()
    .describe("Szkic wniosku o uznanie wypadku przy pracy w języku polskim."),
})

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
Jesteś asystentem ZUS. Na podstawie rozmowy użytkownika przygotuj szkic wniosku o uznanie wypadku przy pracy.
Zawrzyj tylko informacje przekazane w czacie – nie wymyślaj danych.
Struktura wniosku (krótko i rzeczowo):
1) Dane poszkodowanego (imię, nazwisko, PESEL, stanowisko, pracodawca) – jeśli brak, zaznacz "brak danych".
2) Data i godzina zdarzenia.
3) Miejsce zdarzenia.
4) Opis przebiegu i okoliczności (kolejność zdarzeń).
5) Urazy/dolegliwości.
6) Przyczyny wskazane przez poszkodowanego.
7) Świadkowie (imiona/nazwiska/dane kontaktowe jeśli podano; inaczej "brak danych").
8) Działania po zdarzeniu (pierwsza pomoc, zgłoszenie przełożonemu, zabezpieczenie miejsca).
9) Załączone materiały (jeśli były wspomniane w czacie; inaczej "nie dotyczy").
Zachowaj zwięzły, urzędowy ton. Każdy punkt w oddzielnej linii.
`

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as BodyShape | null
    const messages = parseMessages(body?.messages)

    if (!messages) {
      return NextResponse.json(
        { error: "Brak lub nieprawidłowe wiadomości." },
        { status: 400 }
      )
    }

    const { object } = await generateObject({
      model: google(GEMINI_MODEL),
      schema: ApplicationSchema,
      temperature: 0.25,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    })

    return NextResponse.json(object)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd"
    return NextResponse.json(
      { error: "Nie udało się wygenerować wniosku.", detail: message },
      { status: 500 }
    )
  }
}
