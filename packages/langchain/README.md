# @belcore/langchain

Belcore chat model for [LangChain.js](https://js.langchain.com): long-term memory and an emotion state for your chat app.

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

## Install

```bash
npm install @belcore/langchain @langchain/core
```

## Usage

```ts
import { ChatBelcore } from "@belcore/langchain"

const model = new ChatBelcore({ model: "openai/gpt-4o-mini" })
const res = await model.invoke(history)
res.response_metadata.belcore.emotion
```

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
