# @belcore/ai-sdk

Belcore provider for the [Vercel AI SDK](https://ai-sdk.dev): long-term memory and an emotion state for your chat app, through `generateText` and `streamText`.

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

## Install

```bash
npm install @belcore/ai-sdk ai
```

## Usage

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

## How it works

You keep the conversation history in **your** database and send it with each call. Belcore picks the context that matters from the whole history, answers, and returns the updated emotion state for you to save. Belcore does not store conversation text.

```
your DB ──history──▶ Belcore ──reply + emotion──▶ your DB
```

## Options

| Field | Meaning |
|---|---|
| `emotion` | State returned by the previous call. Omit on the first turn. |
| `traits` | Character traits (`obsession`, `edginess`, `stability`, 0–100). |
| `intimacyLevel` | Relationship level (0–10). |
| `endUserId`, `subjectId` | Optional. Let Belcore keep the numeric emotion state for you instead of sending `emotion`. Export or delete it any time. |

## Limits

- Text only. File parts, tool calls and reasoning parts are dropped with a warning.
- Tool calling is not supported.
- `temperature`, `maxOutputTokens` and similar settings are ignored with a warning.


## Links

- All Belcore integrations: https://github.com/terracore-kr/belcore-integrations
- API docs: https://belcore.xyz/developers#docs

## License

Apache-2.0
