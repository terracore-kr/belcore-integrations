/**
 * @belcore/sdk — minimal client for the Belcore memory + emotion engine API.
 *
 * Belcore is stateless by default: you keep the conversation history (and the
 * emotion state Belcore returns) in YOUR database and send it with each call.
 * Belcore selects the relevant long-term context from what you send, answers,
 * and does not store conversation text.
 */

export type Role = "user" | "assistant"
export interface BelcoreMessage { role: Role; content: string }
export interface EmotionState { longing: number; sulkiness: number; emotionUpdatedAt: number }
export interface EmotionTraits { obsession?: number; edginess?: number; stability?: number }

export interface ChatRequest {
  messages: BelcoreMessage[]
  /** System prompt / persona. */
  system?: string
  /** Underlying model id, e.g. "openai/gpt-4o-mini". Omit for Belcore's default. */
  model?: string
  /** Emotion state returned by the previous call (stateless mode). */
  emotion?: Partial<EmotionState>
  traits?: EmotionTraits
  intimacyLevel?: number
  /** Apply time-based emotion transition since the last turn (default true). */
  advance?: boolean
  /** Optional: let Belcore keep the numeric emotion state for this end user instead of you. */
  endUserId?: string
  subjectId?: string
}

export interface ChatResponse {
  reply: string
  emotion?: EmotionState
  directiveActive?: boolean
  model?: string
  usage?: { inputTokens?: number; outputTokens?: number }
  degraded?: boolean
  /** "long-term" when the whole history was searched, "recent" when only the recent window was used. */
  memory?: "long-term" | "recent"
  stateful?: boolean
  saved?: boolean
}

export interface BelcoreClientOptions {
  /** API key (sk_live_...). Defaults to process.env.BELCORE_API_KEY. */
  apiKey?: string
  /** Defaults to https://belcore.xyz/api/v1 */
  baseURL?: string
  fetch?: typeof fetch
  headers?: Record<string, string>
}

export class BelcoreAPIError extends Error {
  constructor(readonly status: number, message: string, readonly body?: unknown) {
    super(`Belcore API ${status}: ${message}`)
    this.name = "BelcoreAPIError"
  }
}

export const DEFAULT_BASE_URL = "https://belcore.xyz/api/v1"

function envKey(): string | undefined {
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return p?.env?.BELCORE_API_KEY
}

export class Belcore {
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly fetchImpl: typeof fetch
  private readonly extraHeaders: Record<string, string>

  constructor(opts: BelcoreClientOptions = {}) {
    const key = opts.apiKey ?? envKey()
    if (!key) throw new Error("Belcore API key missing: pass { apiKey } or set BELCORE_API_KEY.")
    if (!/^[\x21-\x7e]+$/.test(key.trim())) throw new Error("Belcore API key looks wrong: it must be the sk_... key exactly as issued (no spaces or non-ASCII characters).")
    this.apiKey = key.trim()
    this.baseURL = (opts.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.extraHeaders = opts.headers ?? {}
  }

  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await this.fetchImpl(`${this.baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...this.extraHeaders,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
    const text = await res.text()
    let json: unknown
    try { json = text ? JSON.parse(text) : undefined } catch { json = undefined }
    if (!res.ok) {
      const msg = (json as { error?: unknown })?.error
      throw new BelcoreAPIError(res.status, typeof msg === "string" ? msg : res.statusText || "request failed", json ?? text)
    }
    return json as T
  }

  /** One chat turn. Send the full history you keep; Belcore picks the relevant long-term context. */
  chat(req: ChatRequest, opts: { signal?: AbortSignal } = {}): Promise<ChatResponse> {
    if (!Array.isArray(req.messages) || !req.messages.some((m) => m.role === "user")) {
      throw new Error("chat(): 'messages' must contain at least one user message.")
    }
    return this.request<ChatResponse>("POST", "/chat", req, opts.signal)
  }

  /** Download what Belcore holds for an end user (only used if you opted into endUserId mode). */
  exportMemory(endUserId: string, opts: { subjectId?: string; history?: boolean } = {}): Promise<unknown> {
    const q = new URLSearchParams({ endUserId })
    if (opts.subjectId) q.set("subjectId", opts.subjectId)
    if (opts.history === false) q.set("history", "0")
    return this.request("GET", `/memory/export?${q.toString()}`)
  }

  /** Delete everything Belcore holds for an end user. */
  deleteUser(endUserId: string): Promise<unknown> {
    return this.request("DELETE", `/memory/user?${new URLSearchParams({ endUserId }).toString()}`)
  }

  usage(): Promise<unknown> {
    return this.request("GET", "/usage")
  }
}
