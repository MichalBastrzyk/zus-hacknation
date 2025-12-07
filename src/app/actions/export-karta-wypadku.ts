"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { Buffer } from "node:buffer"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { analysis as analysisTable } from "@/db/schema"
import type { AccidentCard } from "@/lib/extractors"

type ExportResult = {
  url: string
  fileName: string
  mimeType: string
}

export async function exportKartaWypadkuUrl(
  caseId: string
): Promise<ExportResult> {
  if (!caseId) {
    throw new Error("Brak identyfikatora zgłoszenia")
  }

  const record = await db.query.analysis.findFirst({
    where: eq(analysisTable.id, caseId),
  })

  if (!record) {
    throw new Error("Nie znaleziono zgłoszenia o podanym ID")
  }

  // Lazy-load, because the packages ship commonjs builds without full TS types.
  const [{ default: Docxtemplater }, { default: PizZip }] = await Promise.all([
    import("docxtemplater"),
    import("pizzip"),
  ])

  const templatePath = path.join(process.cwd(), "wzor-karta-wypadku.docx")
  const templateContent = await fs.readFile(templatePath)

  const zip = new PizZip(templateContent)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "", // Ensure missing data does not break rendering.
  })

  const accidentCard = record.accidentCard as AccidentCard | null

  const pick = (value?: string | null) => value ?? ""

  // Map available fields to placeholders used inside the DOCX template.
  // Placeholder keys extracted from wzor-karta-wypadku.docx
  const dataForTemplate = {
    // --- I. DANE PŁATNIKA SKŁADEK ---
    employer_name:
      accidentCard?.employer.employer_name ?? record.employerName ?? "",
    hq_address: pick(accidentCard?.employer.hq_address),
    nip: pick(accidentCard?.employer.nip),
    regon: pick(accidentCard?.employer.regon),
    employer_pesel: pick(accidentCard?.employer.pesel),

    // --- II. DANE POSZKODOWANEGO ---
    injured_first_name:
      accidentCard?.injured.first_name ?? record.injuredFirstName ?? "",
    injured_last_name:
      accidentCard?.injured.last_name ?? record.injuredLastName ?? "",
    pesel: pick(accidentCard?.injured.pesel),
    birth_date: pick(accidentCard?.injured.birth.date),
    birth_place: pick(accidentCard?.injured.birth.place),
    address: pick(accidentCard?.injured.address),
    id_kind: pick(accidentCard?.injured.id?.kind),
    id_series: pick(accidentCard?.injured.id?.series),
    id_number: pick(accidentCard?.injured.id?.number),
    insurence_title_code: pick(accidentCard?.injured.insurance_title?.code),
    insurance_title_description: pick(
      accidentCard?.injured.insurance_title?.description
    ),

    // --- III. INFORMACJE O WYPADKU ---
    accident_date: pick(accidentCard?.accident.date ?? record.accidentDate),
    reporters_first_name: pick(accidentCard?.accident.reporters_first_name),
    reporters_last_name: pick(accidentCard?.accident.reporters_last_name),
    accident_description: pick(
      accidentCard?.accident.description ?? record.accidentDescription
    ),
    sobriety_description: pick(accidentCard?.sobriety.evidence_description),

    // --- ŚWIADKOWIE (up to 2) ---
    witnesses_1_first_name: pick(accidentCard?.witnesses?.[0]?.first_name),
    witnesses_1_last_name: pick(accidentCard?.witnesses?.[0]?.last_name),
    witnesses_1_address: pick(accidentCard?.witnesses?.[0]?.address),
    witnesses_2_first_name: pick(accidentCard?.witnesses?.[1]?.first_name),
    witnesses_2_last_name: pick(accidentCard?.witnesses?.[1]?.last_name),
    witnesses_2_address: pick(accidentCard?.witnesses?.[1]?.address),
  }

  doc.render(dataForTemplate)

  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  })

  const mimeType =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  const url = `data:${mimeType};base64,${Buffer.from(buffer).toString(
    "base64"
  )}`

  return {
    url,
    fileName: `karta-wypadku-${record.id}.docx`,
    mimeType,
  }
}
