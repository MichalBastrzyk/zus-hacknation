import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { db } from "@/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  MinusCircle,
  XCircle,
} from "lucide-react"
import type { AnalysisRow } from "@/components/AnalysisTable"
import { ExportButton } from "@/app/cases/_components/export-button"

function toMs(value: number | Date | null | undefined) {
  if (!value) return null
  if (typeof value === "number") return value * 1000
  return Number(value)
}

export default async function Page() {
  const analysisData = await db.query.analysis.findMany({
    orderBy: (table, { desc }) => desc(table.createdAt),
  })

  const rows = analysisData.map((item) => ({
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
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Rejestr analiz</h1>
          <p className="text-muted-foreground">
            Przegląd wszystkich zgłoszonych wypadków i ich analiz.
          </p>
        </div>
        <Button asChild>
          <Link href="/cases/upload">Dodaj nowe zgłoszenie</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center text-muted-foreground shadow-sm">
          <p className="text-lg font-medium">Brak zapisanych analiz</p>
          <p className="text-sm mt-1">
            Dodaj nowe zgłoszenie, aby rozpocząć analizę wypadków.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Pracodawca</TableHead>
                <TableHead>Stanowisko</TableHead>
                <TableHead>Data wypadku</TableHead>
                <TableHead>Miejsce</TableHead>
                <TableHead>Decyzja</TableHead>
                <TableHead className="w-[120px]">Pewność</TableHead>
                <TableHead>Przesłanki</TableHead>
                <TableHead>Uwagi</TableHead>
                <TableHead>Data analizy</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const decisionStyle = getDecisionStyle(row.decision)
                const confidencePct = Math.round(
                  (row.confidenceLevel ?? 0) * 100
                )
                const criteriaCount = getCriteriaSummary(row.criteriaAnalysis)
                const flawsCount = row.identifiedFlaws.length

                return (
                  <TableRow key={row.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">
                      {row.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.injuredFirstName || row.injuredLastName ? (
                        [row.injuredFirstName, row.injuredLastName]
                          .filter(Boolean)
                          .join(" ")
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.employerName || (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.positionSnapshot || (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.accidentDate || (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[150px] truncate"
                      title={row.accidentPlace ?? undefined}
                    >
                      {row.accidentPlace || (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {decisionStyle.icon}
                        <Badge className={decisionStyle.badgeClass}>
                          {decisionStyle.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={confidencePct} className="h-2 w-16" />
                        <span className="text-xs font-medium text-slate-600 w-8">
                          {confidencePct}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CriteriaBadge
                        met={criteriaCount.met}
                        total={criteriaCount.total}
                      />
                    </TableCell>
                    <TableCell>
                      {flawsCount > 0 ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-50 text-amber-700 border border-amber-200"
                        >
                          {flawsCount}{" "}
                          {flawsCount === 1
                            ? "uwaga"
                            : flawsCount < 5
                            ? "uwagi"
                            : "uwag"}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200"
                        >
                          Brak
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.createdAtMs
                        ? format(row.createdAtMs, "dd.MM.yyyy", { locale: pl })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={`/cases/${row.id}`}
                          className="flex items-center gap-1.5"
                        >
                          <Eye className="h-4 w-4" />
                          Szczegóły
                        </Link>
                      </Button>
                      <ExportButton caseId={row.id} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
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
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      }
    case "REJECTED":
      return {
        label: "Odrzucony",
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-200",
        icon: <XCircle className="h-4 w-4 text-rose-600" />,
      }
    case "NEEDS_CLARIFICATION":
      return {
        label: "Do wyjaśnienia",
        badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
        icon: <AlertCircle className="h-4 w-4 text-amber-600" />,
      }
    default:
      return {
        label: "Brak decyzji",
        badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
        icon: <MinusCircle className="h-4 w-4 text-slate-500" />,
      }
  }
}

function getCriteriaSummary(criteria: AnalysisRow["criteriaAnalysis"]): {
  met: number
  total: number
} {
  if (!criteria) return { met: 0, total: 3 }

  let met = 0
  if (criteria.suddenness?.met) met++
  if (criteria.external_cause?.met) met++
  if (criteria.work_connection?.met) met++

  return { met, total: 3 }
}

function CriteriaBadge({ met, total }: { met: number; total: number }) {
  const allMet = met === total
  const noneMet = met === 0

  let className = "border "
  if (allMet) {
    className += "bg-emerald-50 text-emerald-700 border-emerald-200"
  } else if (noneMet) {
    className += "bg-rose-50 text-rose-700 border-rose-200"
  } else {
    className += "bg-amber-50 text-amber-700 border-amber-200"
  }

  return (
    <Badge variant="secondary" className={className}>
      {met}/{total}
    </Badge>
  )
}
