"use server"

import crypto from "crypto"

import { db } from "@/db"
import { analysis } from "@/db/schema"
import type { AccidentDecision } from "@/lib/validators"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type SubmitPayload = {
  messages: ChatMessage[]
  decision: AccidentDecision
  attachments?: { name: string; hash?: string }[]
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (!m) return trimmed || null

  const dd = m[1].padStart(2, "0")
  const mm = m[2].padStart(2, "0")
  const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3].padStart(4, "0")
  return `${yyyy}-${mm}-${dd}`
}

function extractFromTranscript(transcript: string) {
  const pick = (patterns: RegExp[]): string | null => {
    for (const re of patterns) {
      const m = transcript.match(re)
      if (m?.[1]) return m[1].trim()
    }
    return null
  }

  const firstName = pick([
    /imi[eę]?\s*[:\-]\s*([A-ZŁŚŻŹĆÓŃ][A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\-]+)/i,
  ])

  const lastName = pick([
    /nazwisko\s*[:\-]\s*([A-ZŁŚŻŹĆÓŃ][A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż\-]+)/i,
  ])

  const employer = pick([
    /(pracodawca|firma|zakład pracy)\s*[:\-]\s*([^\n]{3,})/i,
  ])

  const position = pick([/(stanowisko)\s*[:\-]\s*([^\n]{3,})/i])

  const accidentDateRaw = pick([
    /(data\s+wypadku|data)\s*[:\-]\s*([0-9]{1,4}[./\-][0-9]{1,2}[./\-][0-9]{1,4})/i,
  ])

  const accidentPlace = pick([
    /(miejsce\s+wypadku|miejsce)\s*[:\-]\s*([^\n]{3,})/i,
  ])

  const accidentDescription = pick([/(opis|przebieg)\s*[:\-]\s*([^\n]{8,})/i])

  const accidentCause = pick([/(przyczyna)\s*[:\-]\s*([^\n]{4,})/i])

  return {
    firstName,
    lastName,
    employer,
    position,
    accidentDateRaw,
    accidentPlace,
    accidentDescription,
    accidentCause,
  }
}

export async function submitCase({
  messages,
  decision,
  attachments,
}: SubmitPayload) {
  if (!decision) {
    throw new Error("Brak decyzji do zapisania")
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "U" : "A"}: ${m.content}`)
    .join("\n")

  const firstUserMessage = messages.find((m) => m.role === "user")?.content
  const primaryText = firstUserMessage || transcript || "Brak opisu"

  const hash = crypto
    .createHash("sha512")
    .update(JSON.stringify({ decision, transcript }))
    .digest("hex")

  const extracted = decision.extracted_data ?? {}
  const fallback = extractFromTranscript(transcript)

  const merged = {
    injuredFirstName:
      extracted.injured_first_name ?? fallback.firstName ?? null,
    injuredLastName: extracted.injured_last_name ?? fallback.lastName ?? null,
    employerName: extracted.employer_name ?? fallback.employer ?? null,
    positionSnapshot: extracted.position ?? fallback.position ?? null,
    accidentDate: normalizeDate(
      extracted.accident_date ?? fallback.accidentDateRaw ?? null
    ),
    accidentPlace: extracted.accident_place ?? fallback.accidentPlace ?? null,
    accidentDescription:
      extracted.accident_description ??
      fallback.accidentDescription ??
      primaryText,
    accidentCause:
      extracted.accident_cause ??
      fallback.accidentCause ??
      decision.criteria_analysis.external_cause.justification,
  }

  const [row] = await db
    .insert(analysis)
    .values({
      decision: decision.decision.type,
      confidenceLevel: decision.decision.confidence_level,
      criteriaAnalysis: decision.criteria_analysis,
      identifiedFlaws: decision.identified_flaws,
      suggestedFollowUpQuestions: decision.suggested_follow_up_questions ?? [],
      injuredFirstName: merged.injuredFirstName,
      injuredLastName: merged.injuredLastName,
      employerName: merged.employerName,
      positionSnapshot: merged.positionSnapshot,
      accidentDate: merged.accidentDate,
      accidentPlace: merged.accidentPlace,
      accidentDescription: merged.accidentDescription,
      accidentCause: merged.accidentCause,
      attachedDocuments:
        attachments?.map((item, idx) => ({
          name: item.name,
          hash:
            item.hash ||
            crypto
              .createHash("sha256")
              .update(`${item.name}-${hash}-${idx}`)
              .digest("hex"),
        })) ?? null,
    })
    .returning({ id: analysis.id })

  return { id: row.id, hash }
}
