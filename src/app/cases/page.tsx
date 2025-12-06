import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { db } from "@/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowUpRight } from "lucide-react"
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageCircleQuestion,
  MinusCircle,
  XCircle,
} from "lucide-react"
import type { AnalysisRow } from "@/components/AnalysisTable"

function toMs(value: number | Date | null | undefined) {
  if (!value) return null
  if (typeof value === "number") return value * 1000
  return Number(value)
}

export default async function Page() {
  const analysis = await db.query.analysis.findMany({
    orderBy: (table, { desc }) => desc(table.createdAt),
  })

  const rows: AnalysisRow[] = analysis.map((item) => ({
    id: item.id,
    decision: item.decision ?? null,
    confidenceLevel: item.confidenceLevel ?? 0,
    criteriaAnalysis:
      (item as { criteriaAnalysis?: AnalysisRow["criteriaAnalysis"] })
        .criteriaAnalysis ?? null,
    identifiedFlaws: item.identifiedFlaws ?? [],
    suggestedFollowUpQuestions: item.suggestedFollowUpQuestions ?? [],
    attachedDocuments: item.attachedDocuments ?? [],
    createdAtMs: toMs(item.createdAt),
    injuredFirstName: item.injuredFirstName ?? null,
    injuredLastName: item.injuredLastName ?? null,
    employerName: item.employerName ?? null,
    positionSnapshot: item.positionSnapshot ?? null,
    accidentDate: item.accidentDate ?? null,
    accidentPlace: item.accidentPlace ?? null,
    accidentDescription: item.accidentDescription ?? null,
    accidentCause: item.accidentCause ?? null,
  }))

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rejestr analiz</h1>
          <p className="text-muted-foreground">
            Wszystkie kluczowe informacje widoczne od razu: werdykt, pewność,
            przesłanki, nieprawidłowości, pytania uzupełniające i załączniki.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/cases/upload">Dodaj nowe zgłoszenie</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground shadow-sm">
          Brak zapisanych analiz.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const decisionStyle = getDecisionStyle(row.decision)
            const confidencePct = Math.round((row.confidenceLevel ?? 0) * 100)

            return (
              <div
                key={row.id}
                className="flex flex-col rounded-lg border bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-slate-500">
                      {row.id.slice(0, 10)}
                    </p>
                    <div className="flex items-center gap-2">
                      {decisionStyle.icon}
                      <Badge className={decisionStyle.badgeClass}>
                        {decisionStyle.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.createdAtMs
                        ? format(row.createdAtMs, "dd.MM.yyyy HH:mm", {
                            locale: pl,
                          })
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-2 text-right">
                    <p className="text-xs font-semibold text-slate-600">
                      Pewność
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <Progress value={confidencePct} className="h-2 w-24" />
                      <span className="text-sm font-semibold text-slate-800">
                        {confidencePct}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    {row.injuredFirstName || row.injuredLastName
                      ? [row.injuredFirstName, row.injuredLastName]
                          .filter(Boolean)
                          .join(" ")
                      : "Brak imienia i nazwiska"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.employerName || "Brak pracodawcy"}
                    {row.positionSnapshot ? ` • ${row.positionSnapshot}` : ""}
                  </p>
                  <Section
                    title="Przesłanki"
                    icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  >
                    <div className="grid gap-2 text-sm text-slate-700">
                      <Criterion
                        label="Nagłość"
                        value={row.criteriaAnalysis?.suddenness?.justification}
                        met={row.criteriaAnalysis?.suddenness?.met}
                      />
                      <Criterion
                        label="Przyczyna zewnętrzna"
                        value={
                          row.criteriaAnalysis?.external_cause?.justification
                        }
                        met={row.criteriaAnalysis?.external_cause?.met}
                      />
                      <Criterion
                        label="Związek z pracą"
                        value={
                          row.criteriaAnalysis?.work_connection?.justification
                        }
                        met={row.criteriaAnalysis?.work_connection?.met}
                      />
                    </div>
                  </Section>

                  <Section
                    title="Nieprawidłowości"
                    icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
                  >
                    {row.identifiedFlaws.length > 0 ? (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {row.identifiedFlaws.map((flaw, idx) => (
                          <li
                            key={idx}
                            className="rounded-md border border-amber-200 bg-amber-50/80 p-2"
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
                  </Section>

                  <Section
                    title="Pytania uzupełniające"
                    icon={
                      <MessageCircleQuestion className="h-4 w-4 text-slate-500" />
                    }
                  >
                    {row.suggestedFollowUpQuestions.length > 0 ? (
                      <ul className="space-y-1 text-sm text-slate-700 list-disc list-inside">
                        {row.suggestedFollowUpQuestions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Brak dodatkowych pytań.
                      </p>
                    )}
                  </Section>

                  <Section
                    title="Załączniki"
                    icon={<FileText className="h-4 w-4 text-slate-500" />}
                  >
                    {row.attachedDocuments.length > 0 ? (
                      <ul className="space-y-1 text-sm text-slate-700">
                        {row.attachedDocuments.map((doc, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="font-medium">{doc.name}</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {doc.hash?.slice(0, 12) || "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Brak załączników.
                      </p>
                    )}
                  </Section>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/cases/${row.id}`}
                        className="flex items-center gap-1"
                      >
                        Szczegóły
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getDecisionStyle(decision: AnalysisRow["decision"]): {
  label: string
  badgeClass: string
  icon: React.ReactNode
} {
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

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Criterion({
  label,
  value,
  met,
}: {
  label: string
  value?: string
  met?: boolean
}) {
  const stateClass = met === false ? "text-rose-700" : "text-emerald-700"
  const pillClass =
    met === false
      ? "bg-rose-50 text-rose-700 border border-rose-200"
      : "bg-emerald-50 text-emerald-700 border border-emerald-200"

  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50/60 p-2">
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
      <p className="text-sm text-slate-700">{value || "Brak opisu"}</p>
    </div>
  )
}
