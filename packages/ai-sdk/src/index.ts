/**
 * @belcore/ai-sdk — Belcore as a Vercel AI SDK model provider.
 *
 *   import { belcore } from "@belcore/ai-sdk"
 *   import { generateText } from "ai"
 *   const { text, providerMetadata } = await generateText({
 *     model: belcore("openai/gpt-4o-mini"),
 *     messages: historyFromYourDb,
 *     providerOptions: { belcore: { emotion: lastEmotion } },
 *   })
 *   // save providerMetadata.belcore.emotion for the next turn
 *
 * Belcore receives the full history you pass, selects long-term context, and
 * returns one answer. Tool calling and file inputs are not supported (yet);
 * streaming is emulated (one chunk).
 */
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4Warning,
} from "@ai-sdk/provider"
import { Belcore, type BelcoreClientOptions, type BelcoreMessage, type ChatRequest, type ChatResponse } from "@belcore/sdk"

export type BelcoreProviderOptions = Pick<ChatRequest, "emotion" | "traits" | "intimacyLevel" | "advance" | "endUserId" | "subjectId">

function toBelcore(prompt: LanguageModelV4Prompt, warnings: SharedV4Warning[]): { system?: string; messages: BelcoreMessage[] } {
  const systems: string[] = []
  const messages: BelcoreMessage[] = []
  let droppedNonText = false
  for (const m of prompt) {
    if (m.role === "system") { systems.push(m.content); continue }
    if (m.role === "tool") { droppedNonText = true; continue }
    const text = m.content
      .map((p) => (p.type === "text" ? p.text : ((droppedNonText = true), "")))
      .filter(Boolean)
      .join("\n")
    if (text) messages.push({ role: m.role, content: text })
  }
  if (droppedNonText) warnings.push({ type: "other", message: "Belcore accepts text only; non-text parts (files, tool calls/results, reasoning) were dropped." } as SharedV4Warning)
  return { system: systems.length ? systems.join("\n\n") : undefined, messages }
}

function unsupported(o: LanguageModelV4CallOptions, warnings: SharedV4Warning[]) {
  const names: string[] = []
  if (o.tools?.length) names.push("tools")
  if (o.temperature !== undefined) names.push("temperature")
  if (o.maxOutputTokens !== undefined) names.push("maxOutputTokens")
  if (o.topP !== undefined) names.push("topP")
  if (o.topK !== undefined) names.push("topK")
  if (o.seed !== undefined) names.push("seed")
  if (o.stopSequences?.length) names.push("stopSequences")
  if (o.responseFormat && o.responseFormat.type !== "text") names.push("responseFormat")
  for (const n of names) warnings.push({ type: "unsupported", feature: n } as unknown as SharedV4Warning)
}

export class BelcoreLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const
  readonly provider = "belcore"
  readonly supportedUrls = {}
  constructor(readonly modelId: string, private readonly client: Belcore) {}

  private async call(o: LanguageModelV4CallOptions) {
    const warnings: SharedV4Warning[] = []
    unsupported(o, warnings)
    const { system, messages } = toBelcore(o.prompt, warnings)
    const extra = (o.providerOptions?.belcore ?? {}) as BelcoreProviderOptions
    const body: ChatRequest = { ...extra, messages, ...(system ? { system } : {}), ...(this.modelId && this.modelId !== "default" ? { model: this.modelId } : {}) }
    const res = await this.client.chat(body, { signal: o.abortSignal })
    return { res, warnings, body }
  }

  private meta(res: ChatResponse) {
    return {
      belcore: {
        ...(res.emotion ? { emotion: res.emotion as unknown as Record<string, number> } : {}),
        memory: res.memory ?? null,
        degraded: res.degraded ?? false,
        directiveActive: res.directiveActive ?? false,
        ...(res.stateful ? { stateful: true, saved: res.saved ?? false } : {}),
      },
    }
  }

  private usage(res: ChatResponse) {
    return {
      inputTokens: { total: res.usage?.inputTokens, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: res.usage?.outputTokens, text: res.usage?.outputTokens, reasoning: undefined },
    }
  }

  async doGenerate(o: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const { res, warnings, body } = await this.call(o)
    return {
      content: [{ type: "text", text: res.reply }],
      finishReason: { unified: "stop", raw: undefined },
      usage: this.usage(res),
      providerMetadata: this.meta(res),
      request: { body },
      response: { modelId: res.model },
      warnings,
    }
  }

  async doStream(o: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    const { res, warnings, body } = await this.call(o)
    const parts: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings },
      { type: "response-metadata", modelId: res.model },
      { type: "text-start", id: "0" },
      { type: "text-delta", id: "0", delta: res.reply },
      { type: "text-end", id: "0" },
      { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: this.usage(res), providerMetadata: this.meta(res) },
    ]
    const stream = new ReadableStream<LanguageModelV4StreamPart>({
      start(c) { for (const p of parts) c.enqueue(p); c.close() },
    })
    return { stream, request: { body } }
  }
}

export interface BelcoreProvider {
  (modelId?: string): BelcoreLanguageModel
  languageModel(modelId?: string): BelcoreLanguageModel
}

export function createBelcore(opts: BelcoreClientOptions = {}): BelcoreProvider {
  let client: Belcore | undefined
  const get = () => (client ??= new Belcore(opts))
  const make = (id = "default") => new BelcoreLanguageModel(id, get())
  const p = ((id?: string) => make(id)) as BelcoreProvider
  p.languageModel = make
  return p
}

/** Default provider; reads BELCORE_API_KEY on first use. */
export const belcore = createBelcore()
