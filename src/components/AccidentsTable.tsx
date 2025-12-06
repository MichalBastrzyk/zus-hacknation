"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

interface Accident {
  id: string
  injuredPersonName: string | null
  injuredPersonLastName: string | null
  companyName: string | null
  accidentType: string
  accidentSeverity: string
  accidentDate: string
  accidentPlace: string
  status: string
  createdAt: Date
  accidentDescription: string
  accidentCause: string | null
}

interface AccidentsTableProps {
  accidents: Accident[]
  isLoading?: boolean
}

const severityColors: Record<string, string> = {
  lekki: "bg-blue-100 text-blue-800",
  ciezki: "bg-orange-100 text-orange-800",
  smiertelny: "bg-red-100 text-red-800",
  zbiorowy: "bg-purple-100 text-purple-800",
}

const statusColors: Record<string, string> = {
  szkic: "bg-gray-100 text-gray-800",
  zlozony: "bg-yellow-100 text-yellow-800",
  zaakceptowany: "bg-green-100 text-green-800",
  odrzucony: "bg-red-100 text-red-800",
}

const statusDescriptions: Record<string, string> = {
  szkic: "Raport w trakcie przygotowania",
  zlozony: "Raport złożony i czeka na rozpatrzenie",
  zaakceptowany: "Raport zaakceptowany przez ZUS",
  odrzucony: "Raport odrzucony",
}

export function AccidentsTable({ accidents, isLoading }: AccidentsTableProps) {
  if (isLoading) {
    return <div className="p-4">Ładowanie danych...</div>
  }

  if (accidents.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Brak wypadków w bazie danych
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pracownik</TableHead>
            <TableHead>Pracodawca</TableHead>
            <TableHead>Typ wypadku</TableHead>
            <TableHead>Ciężkość</TableHead>
            <TableHead>Data wypadku</TableHead>
            <TableHead>Miejsce</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data dodania</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accidents.map((accident) => (
            <TableRow key={accident.id}>
              <TableCell>
                {accident.injuredPersonName} {accident.injuredPersonLastName}
              </TableCell>
              <TableCell>{accident.companyName || "-"}</TableCell>
              <TableCell className="capitalize">
                {accident.accidentType.replace(/_/g, " ")}
              </TableCell>
              <TableCell>
                <span
                  className={`px-2 py-1 rounded text-sm ${
                    severityColors[accident.accidentSeverity] || "bg-gray-100"
                  }`}
                >
                  {accident.accidentSeverity}
                </span>
              </TableCell>
              <TableCell>{accident.accidentDate}</TableCell>
              <TableCell>{accident.accidentPlace}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`px-2 py-1 rounded text-sm cursor-help ${
                        statusColors[accident.status] || "bg-gray-100"
                      }`}
                    >
                      {accident.status}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold">
                          {statusDescriptions[accident.status] ||
                            accident.status}
                        </p>
                      </div>
                      <div className="border-t border-gray-300 pt-2">
                        <p className="text-xs font-semibold text-gray-400 mb-1">
                          Opis wypadku:
                        </p>
                        <p className="text-sm">
                          {accident.accidentDescription}
                        </p>
                      </div>
                      {accident.accidentCause && (
                        <div className="border-t border-gray-300 pt-2">
                          <p className="text-xs font-semibold text-gray-400 mb-1">
                            Przyczyna:
                          </p>
                          <p className="text-sm">{accident.accidentCause}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                {format(new Date(accident.createdAt), "dd MMMM yyyy", {
                  locale: pl,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  )
}
