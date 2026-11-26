import { generateText } from "ai"
import { belcore } from "@belcore/ai-sdk"
import { loadConversation, saveConversation } from "@/lib/store"

export const runtime = "nodejs"

const SYSTEM = "You are a friendly assistant. Use what the user told you earlier in the conversation."

function validId(id: unknown): id is string {
  return typeof id === "string" && /^[\w-]{1,64}$/.test(id)
}

/** Past messages, so the page can show the whole conversation after a reload. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  if (!validId(id)) return Response.json({ error: "bad id" }, { status: 400 })
  const { messages } = await loadConversation(id)
  return Response.json({ messages })
}

/** One chat turn. */
export async function POST(req: Request) {
  const { id, message } = (await req.json().catch(() => ({}))) as { id?: unknown; message?: unknown }
  if (!validId(id) || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Send { id, message }." }, { status: 400 })
  }

  // 1. Load the full history from YOUR database and add the new message.
  const conversation = await loadConversation(id)
  conversation.messages.push({ role: "user", content: message.trim() })

  try {
    // 2. Send the whole history. Belcore picks the turns that matter and answers.
    const { text, providerMetadata } = await generateText({
      model: belcore(),
      system: SYSTEM,
      messages: conversation.messages,
      providerOptions: conversation.emotion ? { belcore: { emotion: conversation.emotion } } : undefined,
    })

    // 3. Save the reply and the new emotion state back to YOUR database.
    const meta = providerMetadata?.belcore as { emotion?: Record<string, number>; memory?: string } | undefined
    conversation.messages.push({ role: "assistant", content: text })
    if (meta?.emotion) conversation.emotion = meta.emotion
    await saveConversation(id, conversation)

    return Response.json({ reply: text, memory: meta?.memory ?? null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[belcore]", msg)
    const missingKey = /API key/i.test(msg)
    return Response.json(
      { error: missingKey ? "Set BELCORE_API_KEY in .env.local (see README)." : "Belcore call failed. Check the server log." },
      { status: 500 },
    )
  }
}
