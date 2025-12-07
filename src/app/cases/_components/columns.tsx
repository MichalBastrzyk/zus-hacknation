"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { format } from "date-fns"
import { pl } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  MinusCircle,
  XCircle,
} from "lucide-react"
import { ExportButton } from "@/app/cases/_components/export-button"

// Types
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

export type CaseRow = {
  id: string
  decision: "APPROVED" | "REJECTED" | "NEEDS_CLARIFICATION" | null
  confidenceLevel: number
  criteriaAnalysis: CriteriaAnalysis | null
  identifiedFlaws: IdentifiedFlaw[]
  suggestedFollowUpQuestions: string[]
  attachedDocuments: AttachedDocument[]
  createdAtMs: number | null
  injuredFirstName: string | null
  injuredLastName: string | null
  employerName: string | null
  positionSnapshot: string | null
  accidentDate: string | null
  accidentPlace: string | null
  accidentDescription: string | null
  accidentCause: string | null
}

// Helper functions
function getDecisionStyle(decision: CaseRow["decision"]): {
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

function getCriteriaSummary(criteria: CaseRow["criteriaAnalysis"]): {
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

// Column definitions
export const columns: ColumnDef<CaseRow>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="ID" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-500">
        {row.original.id.slice(0, 8)}
      </span>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 100,
  },
  {
    id: "fullName",
    accessorFn: (row) =>
      [row.injuredFirstName, row.injuredLastName].filter(Boolean).join(" ") ||
      null,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Imię i nazwisko" />
    ),
    enableSorting: false,
    cell: ({ row }) => {
      const firstName = row.original.injuredFirstName
      const lastName = row.original.injuredLastName
      const fullName = [firstName, lastName].filter(Boolean).join(" ")
      return fullName ? (
        <span className="font-medium">{fullName}</span>
      ) : (
        <span className="text-slate-400">—</span>
      )
    },
    meta: {
      label: "Imię i nazwisko",
      variant: "text",
    },
  },
  {
    enableSorting: false,
    accessorKey: "employerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Pracodawca" />
    ),
    cell: ({ row }) =>
      row.original.employerName || <span className="text-slate-400">—</span>,
    meta: {
      label: "Pracodawca",
      variant: "text",
    },
  },
  {
    accessorKey: "positionSnapshot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Stanowisko" />
    ),
    enableSorting: false,
    cell: ({ row }) =>
      row.original.positionSnapshot || (
        <span className="text-slate-400">—</span>
      ),
    meta: {
      label: "Stanowisko",
      variant: "text",
    },
  },
  {
    accessorKey: "accidentDate",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Data wypadku" />
    ),
    cell: ({ row }) =>
      row.original.accidentDate || <span className="text-slate-400">—</span>,
    meta: {
      label: "Data wypadku",
      variant: "text",
    },
  },
  {
    accessorKey: "accidentPlace",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Miejsce" />
    ),
    cell: ({ row }) => {
      const place = row.original.accidentPlace
      return place ? (
        <span className="max-w-[150px] truncate block" title={place}>
          {place}
        </span>
      ) : (
        <span className="text-slate-400">—</span>
      )
    },
    meta: {
      label: "Miejsce",
      variant: "text",
    },
  },
  {
    accessorKey: "decision",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Decyzja" />
    ),
    cell: ({ row }) => {
      const decisionStyle = getDecisionStyle(row.original.decision)
      return (
        <div className="flex items-center gap-1.5">
          {decisionStyle.icon}
          <Badge className={decisionStyle.badgeClass}>
            {decisionStyle.label}
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id) ?? "null")
    },
    meta: {
      label: "Decyzja",
      variant: "select",
      options: [
        { label: "Uznany", value: "APPROVED" },
        { label: "Odrzucony", value: "REJECTED" },
        { label: "Do wyjaśnienia", value: "NEEDS_CLARIFICATION" },
        { label: "Brak decyzji", value: "null" },
      ],
    },
  },
  {
    accessorKey: "confidenceLevel",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Pewność" />
    ),
    cell: ({ row }) => {
      const confidencePct = Math.round(
        (row.original.confidenceLevel ?? 0) * 100
      )
      return (
        <div className="flex items-center gap-2">
          <Progress value={confidencePct} className="h-2 w-16" />
          <span className="text-xs font-medium text-slate-600 w-8">
            {confidencePct}%
          </span>
        </div>
      )
    },
    meta: {
      label: "Pewność",
      variant: "range",
      range: [0, 100],
      unit: "%",
    },
    size: 120,
  },
  {
    id: "criteria",
    enableSorting: false,
    accessorFn: (row) => {
      const summary = getCriteriaSummary(row.criteriaAnalysis)
      return summary.met
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Przesłanki" />
    ),
    cell: ({ row }) => {
      const criteriaCount = getCriteriaSummary(row.original.criteriaAnalysis)
      return (
        <CriteriaBadge met={criteriaCount.met} total={criteriaCount.total} />
      )
    },
    meta: {
      label: "Przesłanki",
    },
  },
  {
    id: "flaws",
    enableSorting: false,
    accessorFn: (row) => row.identifiedFlaws.length,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Uwagi" />
    ),
    cell: ({ row }) => {
      const flawsCount = row.original.identifiedFlaws.length
      return flawsCount > 0 ? (
        <Badge
          variant="secondary"
          className="bg-amber-50 text-amber-700 border border-amber-200"
        >
          {flawsCount}{" "}
          {flawsCount === 1 ? "uwaga" : flawsCount < 5 ? "uwagi" : "uwag"}
        </Badge>
      ) : (
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-700 border border-emerald-200"
        >
          Brak
        </Badge>
      )
    },
    meta: {
      label: "Uwagi",
    },
  },
  {
    accessorKey: "createdAtMs",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Data analizy" />
    ),
    cell: ({ row }) => {
      const createdAtMs = row.original.createdAtMs
      return (
        <span className="text-sm text-slate-600">
          {createdAtMs
            ? format(createdAtMs, "dd.MM.yyyy", { locale: pl })
            : "—"}
        </span>
      )
    },
    meta: {
      label: "Data analizy",
    },
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Akcje</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <Button asChild size="sm" variant="ghost">
          <Link
            href={`/cases/${row.original.id}`}
            className="flex items-center gap-1.5"
          >
            <Eye className="h-4 w-4" />
            Szczegóły
          </Link>
        </Button>
        <ExportButton caseId={row.original.id} />
      </div>
    ),
    enableHiding: false,
  },
]
