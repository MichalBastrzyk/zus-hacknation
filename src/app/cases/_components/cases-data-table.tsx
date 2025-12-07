"use client"

import * as React from "react"
import { useDataTable } from "@/hooks/use-data-table"
import { DataTable } from "@/components/data-table/data-table"
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar"
import { columns, type CaseRow } from "./columns"

interface CasesDataTableProps {
  data: CaseRow[]
}

export function CasesDataTable({ data }: CasesDataTableProps) {
  const { table } = useDataTable({
    data,
    columns,
    pageCount: Math.ceil(data.length / 10),
    initialState: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
      sorting: [{ id: "createdAtMs", desc: true }],
    },
    getRowId: (row) => row.id,
    enableRowSelection: false,
  })

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
