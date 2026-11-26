import { describe, it, expect, vi } from "vitest"
import { Belcore, BelcoreAPIError } from "@belcore/sdk"
import { createBelcore } from "../packages/ai-sdk/src/index"
import { ChatBelcore } from "../packages/langchain/src/index"
import { buildServer } from "../packages/mcp/src/index"
import { generateText, streamText } from "ai"
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

const OK = { reply: "Your dentist is Dr. Okafor.", emotion: { longing: 10, sulkiness: 0, emotionUpdatedAt: 1 }, model: "openai/gpt-4o-mini", usage: { inputTokens: 120, outputTokens: 8 }, degraded: false, memory: "long-term", directiveActive: false }
function mockFetch(status = 200, body: unknown = OK) {
  const calls: { url: string; init: RequestInit }[] = []
  const f = vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }) })
  return { f: f as unknown as typeof fetch, calls }
}
const hist = [{ role: "user" as const, content: "My dentist is Dr. Okafor." }, { role: "assistant" as const, content: "Noted." }, { role: "user" as const, content: "Who is my dentist?" }]

describe("sdk", () => {
  it("sends bearer key and body to /chat", async () => {
    const { f, calls } = mockFetch()
    const c = new Belcore({ apiKey: "sk_test_x", fetch: f })
    const r = await c.chat({ messages: hist, system: "be brief" })
    expect(r.reply).toContain("Okafor")
    expect(calls[0].url).toBe("https://belcore.xyz/api/v1/chat")
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x")
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ messages: hist, system: "be brief" })
  })
  it("throws BelcoreAPIError with server message", async () => {
    const { f } = mockFetch(401, { error: "Missing API key." })
    const c = new Belcore({ apiKey: "k", fetch: f })
    await expect(c.chat({ messages: hist })).rejects.toMatchObject({ status: 401, name: "BelcoreAPIError" })
  })
  it("rejects history without a user message", () => {
    const c = new Belcore({ apiKey: "k", fetch: mockFetch().f })
    expect(() => c.chat({ messages: [{ role: "assistant", content: "hi" }] })).toThrow()
  })
  it("rejects a placeholder or non-ASCII key with a clear message", () => {
    expect(() => new Belcore({ apiKey: "여기에키", fetch: mockFetch().f })).toThrow(/looks wrong/)
  })
  it("requires a key", () => { const old = process.env.BELCORE_API_KEY; delete process.env.BELCORE_API_KEY; expect(() => new Belcore()).toThrow(); if (old) process.env.BELCORE_API_KEY = old })
})

describe("ai-sdk provider", () => {
  it("generateText maps prompt, returns text + emotion metadata", async () => {
    const { f, calls } = mockFetch()
    const belcore = createBelcore({ apiKey: "k", fetch: f })
    const r = await generateText({ model: belcore("openai/gpt-4o-mini"), system: "persona", messages: hist, providerOptions: { belcore: { emotion: { longing: 5 } } } })
    expect(r.text).toBe(OK.reply)
    const sent = JSON.parse(calls[0].init.body as string)
    expect(sent).toMatchObject({ system: "persona", model: "openai/gpt-4o-mini", emotion: { longing: 5 } })
    expect(sent.messages).toEqual(hist)
    expect((r.providerMetadata as any).belcore.emotion.longing).toBe(10)
    expect((r.providerMetadata as any).belcore.memory).toBe("long-term")
    expect(r.usage.inputTokens).toBe(120)
  })
  it("default model id is omitted from body", async () => {
    const { f, calls } = mockFetch()
    await generateText({ model: createBelcore({ apiKey: "k", fetch: f })(), prompt: "hi" })
    expect(JSON.parse(calls[0].init.body as string).model).toBeUndefined()
  })
  it("streamText emits the reply", async () => {
    const { f } = mockFetch()
    const r = streamText({ model: createBelcore({ apiKey: "k", fetch: f })("openai/gpt-4o-mini"), messages: hist })
    let out = ""; for await (const t of r.textStream) out += t
    expect(out).toBe(OK.reply)
    expect(((await r.providerMetadata) as any).belcore.emotion.longing).toBe(10)
  })
  it("warns on unsupported settings", async () => {
    const { f } = mockFetch()
    const r = await generateText({ model: createBelcore({ apiKey: "k", fetch: f })(), prompt: "hi", temperature: 0.2 })
    expect(r.warnings?.length).toBeGreaterThan(0)
  })
})

describe("langchain", () => {
  it("invoke maps messages and returns emotion in metadata", async () => {
    const { f, calls } = mockFetch()
    const m = new ChatBelcore({ apiKey: "k", fetch: f, model: "openai/gpt-4o-mini" })
    const res = await m.invoke([new SystemMessage("persona"), new HumanMessage("My dentist is Dr. Okafor."), new AIMessage("Noted."), new HumanMessage("Who is my dentist?")])
    expect(res.content).toBe(OK.reply)
    const sent = JSON.parse(calls[0].init.body as string)
    expect(sent.system).toBe("persona"); expect(sent.messages).toEqual(hist)
    expect((res.response_metadata as any).belcore.emotion.longing).toBe(10)
  })
})

describe("mcp", () => {
  it("belcore_chat tool returns reply", async () => {
    const { f } = mockFetch()
    const server = buildServer(new Belcore({ apiKey: "k", fetch: f }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(a)
    const client = new Client({ name: "t", version: "0" }); await client.connect(b)
    const tools = await client.listTools()
    expect(tools.tools.map((t) => t.name).sort()).toEqual(["belcore_chat", "belcore_export_memory"])
    const r: any = await client.callTool({ name: "belcore_chat", arguments: { messages: hist } })
    expect(r.content[0].text).toBe(OK.reply)
    expect(r.structuredContent.memory).toBe("long-term")
  })
})
