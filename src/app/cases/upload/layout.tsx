export default function UploadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 md:p-10">
      <div className="max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Weryfikacja ubezpieczenia</h1>
          <p className="text-muted-foreground">
            Automatycznie sprawdzamy, czy polisa powinna zostać wydana.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
