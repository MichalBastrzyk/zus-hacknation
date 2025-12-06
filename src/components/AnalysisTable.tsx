"use client"

import { Fragment, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  MessageCircleQuestion,
  MinusCircle,
  XCircle,
} from "lucide-react"
import Link from "next/link"

export type CriteriaAnalysis = {
  suddenness: { met: boolean; justification: string }
  external_cause: { met: boolean; justification: string }
  work_connection: { met: boolean; justification: string }
}

export type IdentifiedFlaw = {
  category: string
  detailed_description: string
  severity: "CRITICAL" | "WARNING" | string
}

export type AttachedDocument = { name: string; hash: string }

export type AnalysisRow = {
  id: string
  decision: "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION" | null
  confidenceLevel: number
  criteriaAnalysis: CriteriaAnalysis | null
  identifiedFlaws: IdentifiedFlaw[]
  suggestedFollowUpQuestions: string[]
  attachedDocuments: AttachedDocument[]
  createdAtMs: number | null
  injuredFirstName?: string | null
  injuredLastName?: string | null
  employerName?: string | null
  positionSnapshot?: string | null
  accidentDate?: string | null
  accidentPlace?: string | null
  accidentDescription?: string | null
  accidentCause?: string | null
}

const decisionConfig: Record<
  NonNullable<AnalysisRow["decision"]>,
  { label: string; color: string; bg: string }
> = {
  APPROVED: {
    label: "Uznany",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  REJECTED: {
    label: "Odrzucony",
    color: "text-rose-700",
    bg: "bg-rose-50 border-rose-200",
  },
  NEEDS_CLARIFICATION: {
    label: "Do wyjaśnienia",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return "—"
  return format(new Date(timestamp), "dd.MM.yyyy HH:mm", { locale: pl })
}

function CriteriaBadges({ criteria }: { criteria: CriteriaAnalysis | null }) {
  const items = [
    { key: "Nagłość", met: criteria?.suddenness?.met },
    { key: "Przyczyna zewn.", met: criteria?.external_cause?.met },
    { key: "Związek z pracą", met: criteria?.work_connection?.met },
  ]

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const Icon = item.met === false ? XCircle : CheckCircle2
        const style =
          item.met === false
            ? "bg-rose-50 text-rose-700 border border-rose-200"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
        return (
          <span
            key={item.key}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${style}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.key}
          </span>
        )
      })}
    </div>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-800">{pct}%</span>
    </div>
  )
}

export function AnalysisTable({ records }: { records: AnalysisRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!records.length) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground shadow-sm">
        Brak zapisanych analiz.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Rejestr analiz</h2>
          <p className="text-sm text-muted-foreground">
            Kluczowe informacje dla pracownika ZUS: werdykt, pewność, przesłanki
            i braki.
          </p>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          {records.length} wpisów
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sprawa</TableHead>
            <TableHead>Decyzja</TableHead>
            <TableHead>Pewność</TableHead>
            <TableHead>Przesłanki</TableHead>
            <TableHead>Nieprawidłowości</TableHead>
            <TableHead>Pytania uzupeł.</TableHead>
            <TableHead>Dokumenty</TableHead>
            <TableHead>Data analizy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((row) => {
            const decisionStyle = row.decision
              ? decisionConfig[row.decision]
              : {
                  label: "Brak",
                  color: "text-slate-700",
                  bg: "bg-slate-50 border-slate-200",
                }
            const flawsCount = row.identifiedFlaws?.length || 0
            const documentsCount = row.attachedDocuments?.length || 0
            const followUps = row.suggestedFollowUpQuestions?.length || 0
            const isOpen = expandedId === row.id

            return (
              <Fragment key={row.id}>
                <TableRow
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedId(isOpen ? null : row.id)}
                >
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/cases/${row.id}`}
                      className="text-slate-600 hover:text-emerald-600 hover:underline z-10 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${decisionStyle.bg} ${decisionStyle.color}`}
                    >
                      {row.decision === "APPROVED" && (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {row.decision === "REJECTED" && (
                        <XCircle className="h-4 w-4" />
                      )}
                      {row.decision === "NEEDS_CLARIFICATION" && (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      {row.decision === null && (
                        <MinusCircle className="h-4 w-4" />
                      )}
                      {decisionStyle.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ConfidenceBar value={row.confidenceLevel} />
                  </TableCell>
                  <TableCell>
                    <CriteriaBadges criteria={row.criteriaAnalysis} />
                  </TableCell>
                  <TableCell>
                    {flawsCount > 0 ? (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertCircle className="h-4 w-4" />
                        <span>{flawsCount} braki</span>
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800"
                        >
                          {row.identifiedFlaws[0]?.category ?? "Brak"}
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Brak uwag</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-slate-800">
                      <MessageCircleQuestion className="h-4 w-4 text-slate-500" />
                      <span>{followUps}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-slate-800">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span>{documentsCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {formatDate(row.createdAtMs)}
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow className="bg-slate-50/60">
                    <TableCell colSpan={8} className="p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Szczegóły przesłanek
                          </div>
                          <div className="space-y-2 text-sm text-slate-700">
                            <div>
                              <span className="font-medium">Nagłość:</span>
                              <div className="text-slate-600">
                                {row.criteriaAnalysis?.suddenness
                                  ?.justification || "Brak opisu"}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">
                                Przyczyna zewnętrzna:
                              </span>
                              <div className="text-slate-600">
                                {row.criteriaAnalysis?.external_cause
                                  ?.justification || "Brak opisu"}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">
                                Związek z pracą:
                              </span>
                              <div className="text-slate-600">
                                {row.criteriaAnalysis?.work_connection
                                  ?.justification || "Brak opisu"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            Nieprawidłowości
                          </div>
                          {flawsCount > 0 ? (
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
                            <p className="text-sm text-emerald-700">
                              Brak uwag.
                            </p>
                          )}
                        </div>

                        <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <MessageCircleQuestion className="h-4 w-4 text-slate-500" />
                            Pytania uzupełniające
                          </div>
                          {followUps > 0 ? (
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
                        </div>

                        <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <FileText className="h-4 w-4 text-slate-500" />
                            Załączone dokumenty
                          </div>
                          {documentsCount > 0 ? (
                            <ul className="space-y-1 text-sm text-slate-700">
                              {row.attachedDocuments.map((doc, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center gap-2"
                                >
                                  <span className="font-medium">
                                    {doc.name}
                                  </span>
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
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Link href={`/cases/${row.id}`}>
                          <Button>
                            Przejdź do szczegółów sprawy
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default AnalysisTable
