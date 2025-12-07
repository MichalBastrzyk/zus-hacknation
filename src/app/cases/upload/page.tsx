"use client"

import { Upload, X, ArrowLeft } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import type { AccidentCard } from "@/lib/extractors"
import { AccidentDecision } from "@/lib/validators"
import { AnalysisResult } from "@/components/AnalysisResult"
import { Textarea } from "@/components/ui/textarea"
import { submitCase } from "@/app/actions/submit-case"
import type { ChatMessage } from "@/components/AccidentChat"

export default function FileUploadValidationDemo() {
  const router = useRouter()
  const [files, setFiles] = React.useState<File[]>([])
  const [isSending, setIsSending] = React.useState(false)
  const [result, setResult] = React.useState<AccidentDecision | null>(null)
  const [analyzedFileNames, setAnalyzedFileNames] = React.useState<string[]>([])
  const [isSavingFile, setIsSavingFile] = React.useState(false)
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null)

  const [manualText, setManualText] = React.useState("")
  const [manualResult, setManualResult] =
    React.useState<AccidentDecision | null>(null)
  const [manualMessages, setManualMessages] = React.useState<ChatMessage[]>([])
  const [manualAnalyzing, setManualAnalyzing] = React.useState(false)
  const [manualSaving, setManualSaving] = React.useState(false)
  const [manualFeedback, setManualFeedback] = React.useState<string | null>(
    null
  )
  const [manualError, setManualError] = React.useState<string | null>(null)

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
    setSaveMessage(null)
    setAnalyzedFileNames(files.map((file) => file.name))

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

      const data: AccidentDecision | null = (await response.json()) ?? null
      setResult(data)
      toast("Analiza zakończona.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nieznany błąd"
      toast(`Nie udało się przeprowadzić analizy: ${message}`)
    } finally {
      setIsSending(false)
    }
  }, [files])

  const onSaveAnalysis = React.useCallback(async () => {
    if (!result) {
      toast("Brak wyników do zapisania.")
      return
    }

    setIsSavingFile(true)
    setSaveMessage(null)

    try {
      const accidentCard =
        (result as unknown as { accidentCard?: AccidentCard | null })
          .accidentCard ?? null

      await submitCase({
        messages: [
          {
            role: "user",
            content:
              analyzedFileNames.length > 0
                ? `Zgłoszenie utworzone z plików: ${analyzedFileNames.join(
                    ", "
                  )}`
                : "Zgłoszenie utworzone z przesłanych dokumentów (brak nazw plików).",
          },
        ],
        decision: result,
        accidentCard,
        attachments:
          analyzedFileNames.length > 0
            ? analyzedFileNames.map((name) => ({ name }))
            : undefined,
      })
      setSaveMessage("Zgłoszenie zapisane w bazie.")
      toast("Zgłoszenie zapisane w bazie.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nie udało się zapisać zgłoszenia"
      setSaveMessage(message)
      toast(message)
    } finally {
      setIsSavingFile(false)
    }
  }, [analyzedFileNames, result])

  const onManualAnalyze = React.useCallback(async () => {
    const description = manualText.trim()
    if (!description) {
      toast("Uzupełnij opis zgłoszenia przed analizą.")
      return
    }

    setManualAnalyzing(true)
    setManualResult(null)
    setManualFeedback(null)
    setManualError(null)

    const messages: ChatMessage[] = [{ role: "user", content: description }]
    setManualMessages(messages)

    try {
      const res = await fetch("/api/chat/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        const message = error?.error || "Nie udało się przeanalizować opisu."
        throw new Error(message)
      }

      const data: AccidentDecision = await res.json()
      setManualResult(data)
      toast("Analiza ręcznego zgłoszenia zakończona.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nieznany błąd analizy"
      setManualError(message)
      toast(message)
    } finally {
      setManualAnalyzing(false)
    }
  }, [manualText])

  const onManualSave = React.useCallback(async () => {
    if (!manualResult) {
      toast("Najpierw przeprowadź analizę opisu.")
      return
    }

    if (!manualMessages.length) {
      toast("Brakuje treści zgłoszenia do zapisania.")
      return
    }

    setManualSaving(true)
    setManualFeedback(null)

    try {
      const accidentCard =
        (manualResult as unknown as { accidentCard?: AccidentCard | null })
          .accidentCard ?? null

      await submitCase({
        messages: manualMessages,
        decision: manualResult,
        accidentCard,
        attachments: [{ name: "Ręczne zgłoszenie (tekst)" }],
      })
      setManualFeedback("Zgłoszenie zapisane w bazie.")
      toast("Zgłoszenie zapisane w bazie.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nie udało się zapisać zgłoszenia"
      setManualFeedback(message)
      toast(message)
    } finally {
      setManualSaving(false)
    }
  }, [manualMessages, manualResult])

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="default"
          className="gap-2 px-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do poprzedniej strony
        </Button>
        <div className="hidden text-right text-sm font-medium text-muted-foreground sm:block">
          Możesz przesłać pliki lub wkleić opis zgłoszenia poniżej.
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Analiza dokumentów</h2>
          <p className="text-sm text-muted-foreground">
            Dodaj skany lub PDF-y zgłoszenia, aby model ocenił szanse uznania
            wypadku.
          </p>
        </div>

        <div className="mt-6">
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
                <p className="font-medium text-sm">
                  Przeciągnij i upuść pliki tutaj
                </p>
                <p className="text-muted-foreground text-xs">
                  Maks 3 pliki. Do 2 MB każdy. (zawiadomienia o wypadku,
                  wyjaśnienia itp.)
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
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={onAnalyze}
                  disabled={isSending || files.length === 0}
                >
                  {isSending ? "Analizuję..." : "Wyślij do analizy"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!result || isSavingFile}
                  onClick={onSaveAnalysis}
                >
                  {isSavingFile ? "Zapisuję..." : "Zapisz zgłoszenie"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Pliki są wysyłane z instrukcjami z bazy reguł do modelu Gemini.
              </p>
            </div>
          </FileUpload>
        </div>

        {saveMessage && (
          <p className="mt-3 text-sm text-muted-foreground">{saveMessage}</p>
        )}

        {result && <AnalysisResult result={result} />}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Ręczne zgłoszenie</h2>
          <p className="text-sm text-muted-foreground">
            Wklej treść papierowego formularza lub notatki z wypadku. Model
            wygeneruje werdykt tak jak w czacie.
          </p>
        </div>

        <Textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Opisz przebieg wypadku, miejsce, datę, przyczyny, urazy oraz świadków..."
          rows={6}
          disabled={manualAnalyzing}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={onManualAnalyze} disabled={manualAnalyzing}>
              {manualAnalyzing ? "Analizuję..." : "Przeanalizuj opis"}
            </Button>
            <Button
              variant="secondary"
              disabled={!manualResult || manualSaving}
              onClick={onManualSave}
            >
              {manualSaving ? "Zapisuję..." : "Zapisz zgłoszenie"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Zgłoszenie zostanie zapisane w bazie tak jak rozmowa z asystentem.
          </p>
        </div>

        {manualError && (
          <p className="text-sm text-destructive">{manualError}</p>
        )}
        {manualFeedback && (
          <p className="text-sm text-muted-foreground">{manualFeedback}</p>
        )}

        {manualResult && <AnalysisResult result={manualResult} />}
      </div>
    </div>
  )
}
