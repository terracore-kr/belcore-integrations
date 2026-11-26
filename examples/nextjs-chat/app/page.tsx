"use client"

import { useEffect, useRef, useState } from "react"

type Message = { role: "user" | "assistant"; content: string }

// One conversation per browser. A real app would use its own user/conversation id.
function conversationId(): string {
  const k = "belcore-example-conversation"
  let id = localStorage.getItem(k)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(k, id)
  }
  return id
}

export default function Chat() {
  const [id, setId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [memory, setMemory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cid = conversationId()
    setId(cid)
    fetch(`/api/chat?id=${cid}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !id || busy) return
    setInput("")
    setError(null)
    setBusy(true)
    setMessages((m) => [...m, { role: "user", content: text }])
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, message: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setMessages((m) => [...m, { role: "assistant", content: data.reply }])
      setMemory(data.memory)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    localStorage.removeItem("belcore-example-conversation")
    location.reload()
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", minHeight: "100dvh", boxSizing: "border-box" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Belcore chat example</h1>
        <button onClick={reset} style={{ background: "none", border: "none", color: "#71717a", cursor: "pointer", fontSize: 14 }}>
          New conversation
        </button>
      </header>
      <p style={{ color: "#52525b", fontSize: 14, marginTop: 0 }}>
        Tell it something about yourself, chat about other things, then ask about it. Restart the server and it still
        knows: the history lives in <code>.data/conversations.json</code>.
      </p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              background: m.role === "user" ? "#18181b" : "#fff",
              color: m.role === "user" ? "#fff" : "#18181b",
              border: m.role === "user" ? "none" : "1px solid #e4e4e7",
              borderRadius: 14,
              padding: "10px 14px",
              maxWidth: "80%",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
            }}
          >
            {m.content}
          </div>
        ))}
        {busy && <div style={{ color: "#71717a", fontSize: 14 }}>…</div>}
        <div ref={bottom} />
      </div>

      {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
      {memory && (
        <p style={{ color: "#71717a", fontSize: 12, margin: "0 0 8px" }}>
          Last reply used {memory === "long-term" ? "long-term memory (searched the whole history)" : "recent messages only"}.
        </p>
      )}

      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          style={{ flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8", fontSize: 16 }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{ padding: "0 18px", borderRadius: 12, border: "none", background: "#4f46e5", color: "#fff", fontSize: 16, cursor: "pointer" }}
        >
          Send
        </button>
      </form>
    </main>
  )
}
