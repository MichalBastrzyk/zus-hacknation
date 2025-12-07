"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { MessageCircleMore, Send, XIcon } from "lucide-react"
import type { AccidentCard } from "@/lib/extractors"
import type { AccidentDecision } from "@/lib/validators"
import { submitCase } from "@/app/actions/submit-case"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type MissingField = {
  field: string
  reason: string
  example?: string
}

type ChatResponse = {
  assistant_message: string
  missing_fields: MissingField[]
  follow_up_questions?: string[]
}

const initialGreeting: ChatMessage = {
  role: "assistant",
  content:
    "Cześć! Opisz proszę wypadek przy pracy: miejsce, data i godzina, co się stało krok po kroku, urazy oraz kto widział zdarzenie. Pomogę uzupełnić brakujące elementy.",
}

function uniqBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of arr) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    result.push(item)
  }
  return result
}

export function AccidentChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting])
  const [missingFields, setMissingFields] = useState<MissingField[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [decision, setDecision] = useState<AccidentDecision | null>(null)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [isSubmitting, startSubmit] = useTransition()
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const placeholder = useMemo(
    () =>
      "Np. 3.12.2025, godz. 10:30, hala produkcyjna – poślizg na mokrej podłodze, uderzenie w głowę, obecni świadkowie: Jan K., Anna P.",
    []
  )

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const handleSend = async () => {
    const value = input.trim()
    if (!value || loading) return

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: value },
    ]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      })

      if (!res.ok) {
        throw new Error("Błąd serwera. Spróbuj ponownie.")
      }

      const data = (await res.json()) as ChatResponse

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.assistant_message,
      }

      setMessages((prev) => [...prev, assistantMessage])
      setMissingFields(
        uniqBy(data.missing_fields || [], (i) => i.field.toLowerCase())
      )
      setFollowUps(
        uniqBy(data.follow_up_questions || [], (q) => q.toLowerCase())
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nieznany błąd"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (analyzing) return
    setAnalyzing(true)
    setDecisionError(null)

    try {
      const res = await fetch("/api/chat/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      })

      if (!res.ok) {
        throw new Error("Błąd analizy. Uzupełnij dane i spróbuj ponownie.")
      }

      const data = (await res.json()) as AccidentDecision
      setDecision(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nieznany błąd analizy"
      setDecisionError(message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSubmit = () => {
    if (!decision || isSubmitting) return
    setSubmitMessage(null)
    startSubmit(async () => {
      try {
        const accidentCard =
          (
            decision as unknown as {
              accidentCard?: AccidentCard | null
            }
          ).accidentCard ?? null

        await submitCase({ messages, decision, accidentCard })
        setSubmitMessage(
          "Zgłoszenie zapisane. Urzędnik skontaktuje się wkrótce."
        )
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Nie udało się zapisać zgłoszenia"
        setSubmitMessage(message)
      }
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {!open && (
        <Button
          className="rounded-xl py-2"
          size="lg"
          onClick={() => setOpen(true)}
        >
          <>
            <MessageCircleMore className="size-8" />
            <span>Otwórz asystenta</span>
          </>
        </Button>
      )}

      {open && (
        <Card className="w-full max-w-[480px] border-foreground/10 bg-background/95 backdrop-blur gap-0 py-4">
          <CardHeader className="px-4 pb-3 flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <CardTitle>ZUS Asystent zgłoszeń</CardTitle>
              <CardDescription>
                Pomaga uzupełnić dane o wypadku i wskaże braki.
              </CardDescription>
            </div>
            <Button onClick={() => setOpen(false)} className="size-8">
              <XIcon className="size-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4 px-4 bg-background">
            <ScrollArea className="h-96 rounded-lg border p-3">
              <div className="flex flex-col gap-3">
                {messages.map((message, idx) => (
                  <div
                    key={`${message.role}-${idx}`}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm shadow-sm",
                      message.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground ml-auto"
                    )}
                  >
                    {message.content}
                  </div>
                ))}
                {/* {missingFields.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Brakujące elementy do uzupełnienia:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {missingFields.map((item, idx) => (
                        <Badge key={`${item.field}-${idx}`} variant="outline">
                          {item.field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )} */}
                {followUps.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Pytania doprecyzowujące:
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                      {followUps.map((q, idx) => (
                        <li key={`q-${idx}`}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!decision && messages.length > 2 && (
                  <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground text-sm">
                      Sprawdź wstępny werdykt
                    </div>
                    <div>
                      Upewnij się, że podałeś miejsce, datę i godzinę, przebieg,
                      przyczynę, urazy oraz świadków. Im więcej danych, tym
                      lepsza ocena.
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={handleAnalyze}
                        disabled={analyzing || messages.length < 2}
                        size="sm"
                        className="gap-2"
                      >
                        {analyzing ? "Analizuję..." : "Sprawdź szanse"}
                      </Button>
                      {missingFields.length > 0 && (
                        <Badge variant="outline">
                          Uzupełnij brakujące pola
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {decision && (
                  <div className="rounded-lg border p-3 space-y-3 bg-background">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        Werdykt:
                        <Badge
                          variant={
                            decision.decision.type === "APPROVED"
                              ? "default"
                              : decision.decision.type === "REJECTED"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {decision.decision.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pewność:{" "}
                        {Math.round(decision.decision.confidence_level * 100)}%
                      </div>
                    </div>
                    <Progress
                      value={decision.decision.confidence_level * 100}
                    />

                    <div className="space-y-2 text-sm">
                      <div className="font-semibold">Kryteria</div>
                      <div className="grid gap-1 text-muted-foreground">
                        <span>
                          • Nagłość:{" "}
                          {decision.criteria_analysis.suddenness.met
                            ? "TAK"
                            : "NIE"}{" "}
                          –{" "}
                          {decision.criteria_analysis.suddenness.justification}
                        </span>
                        <span>
                          • Przyczyna zewnętrzna:{" "}
                          {decision.criteria_analysis.external_cause.met
                            ? "TAK"
                            : "NIE"}{" "}
                          –{" "}
                          {
                            decision.criteria_analysis.external_cause
                              .justification
                          }
                        </span>
                        <span>
                          • Związek z pracą:{" "}
                          {decision.criteria_analysis.work_connection.met
                            ? "TAK"
                            : "NIE"}{" "}
                          –{" "}
                          {
                            decision.criteria_analysis.work_connection
                              .justification
                          }
                        </span>
                      </div>
                    </div>

                    {decision.identified_flaws.length > 0 && (
                      <div className="space-y-1 text-sm">
                        <div className="font-semibold">Ryzyka / braki</div>
                        <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                          {decision.identified_flaws.map((flaw, idx) => (
                            <li key={`flaw-${idx}`}>
                              [{flaw.severity}] {flaw.category}:{" "}
                              {flaw.detailed_description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !decision}
                        className="gap-2"
                      >
                        {isSubmitting
                          ? "Wysyłam..."
                          : "Wyślij formalne zgłoszenie do ZUS"}
                      </Button>
                      {submitMessage && (
                        <div className="text-xs text-muted-foreground">
                          {submitMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {decisionError && (
                  <div className="text-sm text-destructive">
                    {decisionError}
                  </div>
                )}

                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder}
                rows={2}
                disabled={loading}
                className="resize-none rounded-lg border border-border/70 bg-background/80 shadow-inner text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  AI pomaga w zebraniu danych, nie wydaje decyzji.
                </div>
                <Button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  size="sm"
                  className="gap-2 px-4"
                >
                  <Send className="size-4" />
                  <span>{loading ? "Wysyłanie..." : "Wyślij"}</span>
                </Button>
              </div>
              <Input className="hidden" type="text" aria-hidden tabIndex={-1} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
