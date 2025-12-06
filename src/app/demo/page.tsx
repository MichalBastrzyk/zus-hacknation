"use client"

import { useEffect, useState, useRef } from "react"
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react"
import { AccidentsTable } from "@/components/AccidentsTable"
import { getAllAccidents, type Accident } from "@/db/dbHelpers/getAccidents"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Page() {
  const [accidents, setAccidents] = useState<Accident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle")
  const [uploadMessage, setUploadMessage] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchAccidents = async () => {
      try {
        const data = await getAllAccidents()
        setAccidents(data)
      } catch (error) {
        console.error("Failed to fetch accidents:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccidents()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile)
      setUploadStatus("idle")
      setUploadMessage("")
    } else {
      setUploadMessage("Proszę wybrać plik PDF")
      setUploadStatus("error")
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("Proszę wybrać plik")
      setUploadStatus("error")
      return
    }

    setIsUploading(true)
    setUploadMessage("Przetwarzanie pliku...")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload/pdf", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setUploadMessage(
          `Plik ${file.name} został pomyślnie przesłany i przetworzony`
        )
        setUploadStatus("success")
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } else {
        const error = await response.json()
        setUploadMessage(
          `Błąd: ${error.message || "Nie udało się przetworzyć pliku"}`
        )
        setUploadStatus("error")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadMessage("Błąd podczas przesyłania pliku")
      setUploadStatus("error")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Wypadki przy pracy</h1>

      {/* PDF Upload Section */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Przesłij PDF do przetworzenia
        </h2>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="pdf-upload-demo"
            />
            <label
              htmlFor="pdf-upload-demo"
              className="block text-sm font-medium mb-2 text-blue-900"
            >
              Wybierz plik PDF
            </label>
            {file ? (
              <div className="text-sm text-blue-700 font-medium">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-blue-300 rounded p-3 text-center text-sm text-blue-600 cursor-pointer hover:border-blue-500 hover:bg-blue-100 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                Kliknij aby wybrać plik PDF
              </div>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Przetwarzanie..." : "Prześlij"}
          </Button>
        </div>

        {/* Status Message */}
        {uploadStatus === "success" && (
          <Alert className="mt-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {uploadMessage}
            </AlertDescription>
          </Alert>
        )}

        {uploadStatus === "error" && (
          <Alert className="mt-4 bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {uploadMessage}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Accidents Table */}
      <AccidentsTable accidents={accidents} isLoading={isLoading} />
    </div>
  )
}
