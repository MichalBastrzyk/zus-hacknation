"use server"

import fs from "node:fs/promises"
import path from "node:path"
import { Buffer } from "node:buffer"

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { analysis as analysisTable } from "@/db/schema"

type ExportResult = {
  url: string
  fileName: string
  mimeType: string
}

function toFullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ")
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

  // Map available fields to placeholders used inside the DOCX template.
  const dataForTemplate = {
    imie_i_nazwisko: toFullName(
      record.injuredFirstName,
      record.injuredLastName
    ),
    pesel: "",
    data_urodzenia: "",
    adres_zamieszkania: "",
    miejsce_urodzenia: "",
    imie_i_nazwisko_platnika: record.employerName ?? "",
    adres_siedziby: "",
    nip: "",
    regon: "",
    pesel_platnika: "",
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
