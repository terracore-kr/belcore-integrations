/**
 * Your database. This example keeps conversations in a local JSON file so it
 * runs with zero setup. In production, swap these two functions for your real
 * database (Postgres, Redis, ...). Belcore never stores the conversation text:
 * this file is the only copy.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type Message = { role: "user" | "assistant"; content: string }
export type Conversation = {
  messages: Message[]
  /** Emotion state returned by Belcore on the last turn. Send it back next turn. */
  emotion?: Record<string, number>
}

const FILE = path.join(process.cwd(), ".data", "conversations.json")

async function readAll(): Promise<Record<string, Conversation>> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"))
  } catch {
    return {}
  }
}

export async function loadConversation(id: string): Promise<Conversation> {
  return (await readAll())[id] ?? { messages: [] }
}

export async function saveConversation(id: string, conversation: Conversation): Promise<void> {
  const all = await readAll()
  all[id] = conversation
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, JSON.stringify(all, null, 2))
}
