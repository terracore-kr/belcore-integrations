/**
 * @belcore/langchain — Belcore as a LangChain.js chat model.
 *
 *   const model = new ChatBelcore({ model: "openai/gpt-4o-mini" })
 *   const res = await model.invoke(historyFromYourDb)
 *   res.response_metadata.belcore.emotion // save for the next call
 */
import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models"
import { AIMessage, type BaseMessage } from "@langchain/core/messages"
import type { ChatResult } from "@langchain/core/outputs"
import { Belcore, type BelcoreClientOptions, type BelcoreMessage, type ChatRequest } from "@belcore/sdk"

export interface ChatBelcoreParams extends BaseChatModelParams, BelcoreClientOptions {
  model?: string
  /** Defaults sent with every call; per-call values can be passed via invoke(..., { belcore: {...} }). */
  belcore?: Omit<ChatRequest, "messages" | "system" | "model">
}

type CallOptions = ChatBelcore["ParsedCallOptions"] & { belcore?: Omit<ChatRequest, "messages" | "system" | "model"> }

export class ChatBelcore extends BaseChatModel {
  static lc_name() { return "ChatBelcore" }
  model?: string
  private client: Belcore
  private defaults: Omit<ChatRequest, "messages" | "system" | "model">

  constructor(params: ChatBelcoreParams = {}) {
    super(params)
    this.model = params.model
    this.client = new Belcore(params)
    this.defaults = params.belcore ?? {}
  }

  _llmType() { return "belcore" }

  async _generate(messages: BaseMessage[], options: CallOptions): Promise<ChatResult> {
    const systems: string[] = []
    const out: BelcoreMessage[] = []
    for (const m of messages) {
      const type = m._getType()
      const text = typeof m.content === "string" ? m.content : m.content.map((c) => ("text" in c && typeof c.text === "string" ? c.text : "")).join("\n")
      if (type === "system") systems.push(text)
      else if (type === "human") out.push({ role: "user", content: text })
      else if (type === "ai") out.push({ role: "assistant", content: text })
    }
    const res = await this.client.chat(
      { ...this.defaults, ...(options.belcore ?? {}), messages: out, ...(systems.length ? { system: systems.join("\n\n") } : {}), ...(this.model ? { model: this.model } : {}) },
      { signal: options.signal },
    )
    const meta = { belcore: { emotion: res.emotion, memory: res.memory, degraded: res.degraded ?? false } }
    return {
      generations: [{ text: res.reply, message: new AIMessage({ content: res.reply, response_metadata: meta }) }],
      llmOutput: { tokenUsage: { promptTokens: res.usage?.inputTokens, completionTokens: res.usage?.outputTokens } },
    }
  }
}
