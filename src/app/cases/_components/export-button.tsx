"use client"

import { exportKartaWypadkuUrl } from "@/app/actions/export-karta-wypadku"
import { Button } from "@/components/ui/button"

interface ExportButtonProps {
  caseId: string
}

export function ExportButton({ caseId }: ExportButtonProps) {
  return (
    <Button
      type="button"
      onClick={async () => {
        const { url, fileName } = await exportKartaWypadkuUrl(caseId)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        a.click()
      }}
    >
      Eksportuj kartę wypadku
    </Button>
  )
}
