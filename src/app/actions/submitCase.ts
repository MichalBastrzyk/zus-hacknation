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

  const [row] = await db
    .insert(analysis)
    .values({
      decision: decision.decision.type,
      confidenceLevel: decision.decision.confidence_level,
      criteriaAnalysis: decision.criteria_analysis,
      identifiedFlaws: decision.identified_flaws,
      suggestedFollowUpQuestions: decision.suggested_follow_up_questions ?? [],
      accidentDescription: primaryText,
      accidentCause: decision.criteria_analysis.external_cause.justification,
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
