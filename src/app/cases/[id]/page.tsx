import Link from "next/link"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  MessageCircleQuestion,
  MinusCircle,
  Scale,
  User,
  Users,
  XCircle,
} from "lucide-react"
import { db } from "@/db"
import { analysis as analysisTable } from "@/db/schema"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { AccidentCard } from "@/lib/extractors"

function formatDate(value: number | Date | string | null | undefined) {
  if (!value) return "—"
  if (typeof value === "number")
    return format(new Date(value), "dd.MM.yyyy HH:mm", { locale: pl })
  const parsed = typeof value === "string" ? new Date(value) : value
  return format(parsed, "dd.MM.yyyy HH:mm", { locale: pl })
}

export default async function AnalysisDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const record = await db.query.analysis.findFirst({
    where: eq(analysisTable.id, id),
  })

  if (!record) {
    notFound()
  }

  const confidencePct = Math.round((record.confidenceLevel ?? 0) * 100)
  const decisionStyle = getDecisionStyle(record.decision ?? null)
  const accidentCard = record.accidentCard as AccidentCard | null

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" size="sm" className="h-8 px-2">
              <Link href="/cases" className="flex items-center gap-2 text-sm">
                <ArrowLeft className="h-4 w-4" />
                Wróć
              </Link>
            </Button>
            <Badge className={decisionStyle.badgeClass}>
              {decisionStyle.label}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Szczegóły analizy
          </h1>
          <p className="text-muted-foreground">
            Kompletny przegląd zgłoszenia do ręcznego rozpatrzenia przez
            pracownika ZUS.
          </p>
        </div>
        <div className="space-y-2 text-right">
          <p className="text-xs font-semibold text-slate-600">Pewność modelu</p>
          <div className="flex items-center gap-2 justify-end">
            <Progress value={confidencePct} className="h-2 w-28" />
            <span className="text-sm font-semibold text-slate-800">
              {confidencePct}%
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {formatDate(record.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* I. DANE PŁATNIKA SKŁADEK */}
          <DetailCard
            title="Dane płatnika składek"
            icon={<Building2 className="h-4 w-4 text-blue-500" />}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info
                label="Nazwa płatnika"
                value={
                  accidentCard?.employer.employer_name ||
                  record.employerName ||
                  "—"
                }
                full
              />
              <Info
                label="Adres siedziby"
                value={accidentCard?.employer.hq_address || "—"}
                full
              />
              <Info label="NIP" value={accidentCard?.employer.nip || "—"} />
              <Info label="REGON" value={accidentCard?.employer.regon || "—"} />
              <Info
                label="PESEL płatnika"
                value={accidentCard?.employer.pesel || "—"}
              />
            </dl>
          </DetailCard>

          {/* II. DANE POSZKODOWANEGO */}
          <DetailCard
            title="Dane poszkodowanego"
            icon={<User className="h-4 w-4 text-emerald-500" />}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info
                label="Imię i nazwisko"
                value={composeName(
                  accidentCard?.injured.first_name || record.injuredFirstName,
                  accidentCard?.injured.last_name || record.injuredLastName
                )}
              />
              <Info label="PESEL" value={accidentCard?.injured.pesel || "—"} />
              <Info
                label="Data urodzenia"
                value={accidentCard?.injured.birth.date || "—"}
              />
              <Info
                label="Miejsce urodzenia"
                value={accidentCard?.injured.birth.place || "—"}
              />
              <Info
                label="Adres zamieszkania"
                value={accidentCard?.injured.address || "—"}
                full
              />
              {accidentCard?.injured.id && (
                <>
                  <Info
                    label="Dokument tożsamości"
                    value={accidentCard.injured.id.kind || "—"}
                  />
                  <Info
                    label="Seria i numer"
                    value={
                      `${accidentCard.injured.id.series || ""} ${
                        accidentCard.injured.id.number || ""
                      }`.trim() || "—"
                    }
                  />
                </>
              )}
              <Info
                label="Tytuł ubezpieczenia"
                value={
                  accidentCard?.injured.insurance_title
                    ? `${accidentCard.injured.insurance_title.code} – ${accidentCard.injured.insurance_title.description}`
                    : "—"
                }
                full
              />
              <Info
                label="Uczeń/student"
                value={
                  accidentCard?.injured.is_student !== undefined
                    ? accidentCard.injured.is_student
                      ? "Tak"
                      : "Nie"
                    : "—"
                }
              />
              <Info label="Stanowisko" value={record.positionSnapshot || "—"} />
            </dl>
          </DetailCard>

          {/* III. INFORMACJE O WYPADKU */}
          <DetailCard
            title="Informacje o wypadku"
            icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info
                label="Data zgłoszenia"
                value={
                  accidentCard?.accident.date || record.accidentDate || "—"
                }
              />
              <Info
                label="Zgłaszający"
                value={composeName(
                  accidentCard?.accident.reporters_first_name,
                  accidentCard?.accident.reporters_last_name
                )}
              />
              <Info label="Miejsce" value={record.accidentPlace || "—"} />
              <Info
                label="Opis zdarzenia"
                value={
                  accidentCard?.accident.description ||
                  record.accidentDescription ||
                  "Brak opisu"
                }
                full
              />
              <Info
                label="Przyczyna"
                value={record.accidentCause || "Brak informacji"}
                full
              />
            </dl>
          </DetailCard>

          {/* KWALIFIKACJA PRAWNA */}
          {accidentCard?.accident.legal_qualification && (
            <DetailCard
              title="Kwalifikacja prawna"
              icon={<Scale className="h-4 w-4 text-indigo-500" />}
            >
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Info
                  label="Czy wypadek przy pracy?"
                  value={
                    accidentCard.accident.legal_qualification
                      .is_accident_at_work
                      ? "TAK"
                      : "NIE"
                  }
                />
                <Info
                  label="Podstawa prawna"
                  value={
                    accidentCard.accident.legal_qualification.legal_basis || "—"
                  }
                />
                <Info
                  label="Uzasadnienie"
                  value={
                    accidentCard.accident.legal_qualification.justification ||
                    "—"
                  }
                  full
                />
              </dl>
            </DetailCard>
          )}

          {/* OKOLICZNOŚCI WYŁĄCZAJĄCE */}
          <DetailCard
            title="Okoliczności wyłączające"
            icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info
                label="Niedbalstwo / naruszenie przepisów"
                value={
                  accidentCard?.accident_causes?.negligence_statement ||
                  "Nie stwierdzono"
                }
                full
              />
              <Info
                label="Nietrzeźwość"
                value={
                  accidentCard?.sobriety.was_intoxicated !== undefined
                    ? accidentCard.sobriety.was_intoxicated
                      ? "Tak"
                      : "Nie"
                    : "—"
                }
              />
              <Info
                label="Dowody nietrzeźwości"
                value={accidentCard?.sobriety.evidence_description || "—"}
                full
              />
            </dl>
          </DetailCard>

          {/* ŚWIADKOWIE */}
          {accidentCard?.witnesses && accidentCard.witnesses.length > 0 && (
            <DetailCard
              title="Świadkowie"
              icon={<Users className="h-4 w-4 text-slate-500" />}
            >
              <ul className="space-y-3">
                {accidentCard.witnesses.map((witness, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <p className="font-medium text-slate-800">
                      {witness.first_name} {witness.last_name}
                    </p>
                    <p className="text-sm text-slate-600">{witness.address}</p>
                  </li>
                ))}
              </ul>
            </DetailCard>
          )}

          <DetailCard
            title="Ocena przesłanek"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          >
            <div className="grid gap-3">
              <Criterion
                label="Nagłość"
                met={record.criteriaAnalysis?.suddenness?.met}
                justification={
                  record.criteriaAnalysis?.suddenness?.justification
                }
              />
              <Criterion
                label="Przyczyna zewnętrzna"
                met={record.criteriaAnalysis?.external_cause?.met}
                justification={
                  record.criteriaAnalysis?.external_cause?.justification
                }
              />
              <Criterion
                label="Związek z pracą"
                met={record.criteriaAnalysis?.work_connection?.met}
                justification={
                  record.criteriaAnalysis?.work_connection?.justification
                }
              />
            </div>
          </DetailCard>

          <DetailCard
            title="Nieprawidłowości"
            icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
          >
            {record.identifiedFlaws.length ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {record.identifiedFlaws.map((flaw, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-amber-200 bg-amber-50/80 p-3"
                  >
                    <div className="flex items-center gap-2 font-medium text-amber-800">
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800"
                      >
                        {flaw.category}
                      </Badge>
                      {flaw.severity === "CRITICAL" && (
                        <span className="text-[11px] font-semibold text-rose-600">
                          Krytyczne
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slate-700">
                      {flaw.detailed_description}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700">Brak uwag.</p>
            )}
          </DetailCard>
        </div>

        <div className="space-y-6">
          {/* META PROCESS */}
          {accidentCard?.meta_process && (
            <DetailCard
              title="Informacje procesowe"
              icon={<FileText className="h-4 w-4 text-slate-500" />}
            >
              <dl className="space-y-3 text-sm">
                <Info
                  label="Zapoznanie z kartą"
                  value={`${
                    accidentCard.meta_process.acknowledgment.person_name || "—"
                  } (${accidentCard.meta_process.acknowledgment.date || "—"})`}
                />
                <Info
                  label="Data sporządzenia"
                  value={accidentCard.meta_process.preparation.date || "—"}
                />
                <Info
                  label="Podmiot sporządzający"
                  value={
                    accidentCard.meta_process.preparation.entity_name || "—"
                  }
                />
                <Info
                  label="Osoba sporządzająca"
                  value={
                    accidentCard.meta_process.preparation.preparer_name || "—"
                  }
                />
                {accidentCard.meta_process.delay_reason && (
                  <Info
                    label="Powód opóźnienia"
                    value={accidentCard.meta_process.delay_reason}
                  />
                )}
                {accidentCard.meta_process.receipt_date && (
                  <Info
                    label="Data odebrania"
                    value={accidentCard.meta_process.receipt_date}
                  />
                )}
                {accidentCard.meta_process.attachments?.length > 0 && (
                  <Info
                    label="Załączniki (karta)"
                    value={accidentCard.meta_process.attachments.join(", ")}
                  />
                )}
              </dl>
            </DetailCard>
          )}

          <DetailCard
            title="Pytania uzupełniające"
            icon={<MessageCircleQuestion className="h-4 w-4 text-slate-500" />}
          >
            {record.suggestedFollowUpQuestions?.length ? (
              <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
                {record.suggestedFollowUpQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Brak dodatkowych pytań.</p>
            )}
          </DetailCard>

          <DetailCard
            title="Załączone dokumenty"
            icon={<FileText className="h-4 w-4 text-slate-500" />}
          >
            {record.attachedDocuments?.length ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {record.attachedDocuments.map((doc, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="font-medium">{doc.name}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      {doc.hash?.slice(0, 14) || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Brak załączników.</p>
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  )
}

function getDecisionStyle(
  decision: "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION" | null
) {
  switch (decision) {
    case "APPROVED":
      return {
        label: "Uznany",
        badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      }
    case "REJECTED":
      return {
        label: "Odrzucony",
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-200",
        icon: <XCircle className="h-5 w-5 text-rose-600" />,
      }
    case "NEEDS_CLARIFICATION":
      return {
        label: "Do wyjaśnienia",
        badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
        icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      }
    default:
      return {
        label: "Brak decyzji",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
        icon: <MinusCircle className="h-5 w-5 text-slate-500" />,
      }
  }
}

function composeName(first?: string | null, last?: string | null) {
  if (first || last) return [first, last].filter(Boolean).join(" ")
  return "Brak danych"
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Info({
  label,
  value,
  full,
}: {
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm text-slate-800 leading-relaxed">{value}</p>
    </div>
  )
}

function Criterion({
  label,
  met,
  justification,
}: {
  label: string
  met?: boolean
  justification?: string
}) {
  const stateClass = met === false ? "text-rose-700" : "text-emerald-700"
  const pillClass =
    met === false
      ? "bg-rose-50 text-rose-700 border border-rose-200"
      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-flex items-center gap-2 ${stateClass}`}>
          {met === false ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {label}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}
        >
          {met === false ? "Niespełniona" : "Spełniona"}
        </span>
      </div>
      <p className="text-sm text-slate-700">{justification || "Brak opisu"}</p>
    </div>
  )
}
