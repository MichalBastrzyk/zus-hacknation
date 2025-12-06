"use client"

import { Upload, X } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload"
import { Button } from "@/components/ui/button"

export default function FileUploadValidationDemo() {
  const [files, setFiles] = React.useState<File[]>([])
  const [isSending, setIsSending] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  const onFileValidate = React.useCallback(
    (file: File): string | null => {
      if (files.length >= 3) {
        return "Możesz dodać maksymalnie 3 pliki. (Zawiadomienia o wypadku, wyjaśnienia itp.)"
      }

      const isImage = file.type.startsWith("image/")
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")

      if (!isImage && !isPdf) {
        return "Dozwolone są tylko obrazy lub pliki PDF."
      }

      const MAX_SIZE = 2 * 1024 * 1024 // 2MB
      if (file.size > MAX_SIZE) {
        return "Rozmiar pliku musi być mniejszy niż 2 MB."
      }

      return null
    },
    [files]
  )

  const onFileReject = React.useCallback((file: File, message: string) => {
    const name =
      file.name.length > 24 ? `${file.name.slice(0, 21)}...` : file.name
    toast(message, {
      description: `Plik "${name}" został odrzucony.`,
    })
  }, [])

  const onAnalyze = React.useCallback(async () => {
    if (!files.length) {
      toast("Dodaj co najmniej jeden plik do analizy.")
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        const message = error?.error || "Nie udało się przeprowadzić analizy."
        toast(message)
        return
      }

      const data = await response.json()
      const text = data?.result || "Brak odpowiedzi z analizy."
      setResult(text)
      toast("Analiza zakończona.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nieznany błąd"
      toast(`Nie udało się przeprowadzić analizy: ${message}`)
    } finally {
      setIsSending(false)
    }
  }, [files])

  return (
    <FileUpload
      value={files}
      onValueChange={setFiles}
      onFileValidate={onFileValidate}
      onFileReject={onFileReject}
      accept="image/*,application/pdf,.pdf"
      maxFiles={3}
      className="w-full"
      multiple
    >
      <FileUploadDropzone>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center rounded-full border p-3">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">Przeciągnij i upuść pliki tutaj</p>
          <p className="text-muted-foreground text-xs">
            Maks 3 pliki. Do 2 MB każdy. (zawiadomienia o wypadku, wyjaśnienia
            itp.)
          </p>
        </div>
        <FileUploadTrigger asChild>
          <Button variant="outline" size="sm" className="mt-3 w-fit">
            Wybierz pliki
          </Button>
        </FileUploadTrigger>
      </FileUploadDropzone>
      <FileUploadList>
        {files.map((file) => (
          <FileUploadItem key={file.name} value={file}>
            <FileUploadItemPreview />
            <FileUploadItemMetadata />
            <FileUploadItemDelete asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Usuń plik"
              >
                <X />
              </Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          onClick={onAnalyze}
          disabled={isSending || files.length === 0}
        >
          {isSending ? "Analizuję..." : "Wyślij do analizy"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Pliki są wysyłane z instrukcjami z bazy reguł do modelu Gemini.
        </p>
      </div>
      {result && (
        <div className="mt-4 rounded border bg-card p-4 text-sm whitespace-pre-wrap">
          {result}
        </div>
      )}
    </FileUpload>
  )
}
