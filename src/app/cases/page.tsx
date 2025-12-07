import Link from "next/link"
import { Suspense } from "react"
import { db } from "@/db"
import { Button } from "@/components/ui/button"
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton"
import { CasesDataTable } from "./_components/cases-data-table"
import type { CaseRow } from "./_components/columns"

function toMs(value: number | Date | null | undefined) {
  if (!value) return null
  if (typeof value === "number") return value * 1000
  return Number(value)
}

export const dynamic = "force-dynamic"

export default async function Page() {
  const analysisData = await db.query.analysis.findMany({
    orderBy: (table, { desc }) => desc(table.createdAt),
  })

  const rows: CaseRow[] = analysisData.map((item) => ({
    id: item.id,
    decision: item.decision ?? null,
    confidenceLevel: item.confidenceLevel ?? 0,
    criteriaAnalysis:
      (item as { criteriaAnalysis?: CaseRow["criteriaAnalysis"] })
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
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden p-4">
          <Suspense
            fallback={
              <DataTableSkeleton
                columnCount={12}
                rowCount={10}
                filterCount={1}
              />
            }
          >
            <CasesDataTable data={rows} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
