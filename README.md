# Belcore integrations

Long-term memory and emotion for your AI app, in one call. Drop Belcore into the stack you already use:

| Package | For |
|---|---|
| `@belcore/sdk` | Plain TypeScript / JavaScript |
| `@belcore/ai-sdk` | Vercel AI SDK (`generateText`, `streamText`) |
| `@belcore/langchain` | LangChain.js |
| `@belcore/mcp` | Any MCP client (Claude Desktop, Cursor, …) |

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

```bash
npm install @belcore/ai-sdk      # Vercel AI SDK
npm install @belcore/langchain   # LangChain.js
npm install @belcore/sdk         # plain client
npx -y @belcore/mcp              # MCP server
```

## How it works

You keep the conversation history in **your** database and send it with each call. Belcore picks the context that matters from the whole history, answers, and returns the updated emotion state for you to save. Belcore does not store conversation text.

```
your DB ──history──▶ Belcore ──reply + emotion──▶ your DB
```

## Vercel AI SDK

```ts
import { generateText } from "ai"
import { belcore } from "@belcore/ai-sdk"

const { text, providerMetadata } = await generateText({
  model: belcore("openai/gpt-4o-mini"),
  system: "You are a helpful insurance assistant.",
  messages: history,                                   // full history from your DB
  providerOptions: { belcore: { emotion: lastEmotion } },
})

await saveEmotion(providerMetadata?.belcore?.emotion)  // send it back next turn
```

`streamText` works too (the reply arrives as one chunk).

## LangChain.js

```ts
import { ChatBelcore } from "@belcore/langchain"

const model = new ChatBelcore({ model: "openai/gpt-4o-mini" })
const res = await model.invoke(history)
res.response_metadata.belcore.emotion
```

## MCP

```json
{
  "mcpServers": {
    "belcore": { "command": "npx", "args": ["-y", "@belcore/mcp"], "env": { "BELCORE_API_KEY": "sk_live_..." } }
  }
}
```

Tools: `belcore_chat`, `belcore_export_memory`.

## Plain SDK

```ts
import { Belcore } from "@belcore/sdk"

const belcore = new Belcore()                    // reads BELCORE_API_KEY
const r = await belcore.chat({ messages: history, emotion: lastEmotion })
r.reply; r.emotion; r.memory                     // "long-term" | "recent"
```

## Options

| Field | Meaning |
|---|---|
| `emotion` | State returned by the previous call. Omit on the first turn. |
| `traits` | Character traits (`obsession`, `edginess`, `stability`, 0–100). |
| `intimacyLevel` | Relationship level (0–10). |
| `endUserId`, `subjectId` | Optional. Let Belcore keep the numeric emotion state for you instead of sending `emotion`. Export or delete it any time. |

## Limits (v0.1)

- Text only. File parts, tool calls and reasoning parts are dropped with a warning.
- Tool calling is not supported.
- `temperature`, `maxOutputTokens` and similar settings are ignored with a warning.

## License

Apache-2.0
