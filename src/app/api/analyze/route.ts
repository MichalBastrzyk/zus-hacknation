import { readFile } from "fs/promises"
import path from "path"
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { NextResponse } from "next/server"
import { AccidentDecisionSchema } from "@/lib/validators"

const GEMINI_MODEL = "gemini-2.0-flash"

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

    const PROMPT = `

    
    `

    const promptIntro =
      "Jesteś asystentem weryfikującym zgłoszenia wypadków przy pracy. " +
      "Analizujesz dokumenty (PDF lub obrazy) oraz stosujesz reguły z dołączonego JSON. " +
      "Podaj decyzję (UZNANY/ODRZUCONY), krótkie uzasadnienie w języku polskim oraz wskaż brakujące dokumenty, jeśli są potrzebne."

    const obj = await generateObject({
      model: google(GEMINI_MODEL),
      schema: AccidentDecisionSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptIntro },
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

    return obj.toJsonResponse()

    // return NextResponse.json({ result: text || "Brak odpowiedzi modelu." })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd"
    return NextResponse.json(
      { error: "Nie udało się przetworzyć żądania", detail: message },
      { status: 500 }
    )
  }
}
