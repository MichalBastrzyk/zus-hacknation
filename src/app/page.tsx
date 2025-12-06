import { AccidentChat } from "@/components/AccidentChat"

export default function Home() {
  return (
    <>
      <iframe
        src="/zus.html"
        className="fixed inset-0 h-screen w-screen border-0"
        title="ZUS"
        allowFullScreen
      />

      <AccidentChat />
    </>
  )
}
