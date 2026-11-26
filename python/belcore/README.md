# belcore

Python client for the [Belcore](https://belcore.xyz) API: long-term memory and an emotion state for your chat app, in one call.

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

## Install

```bash
pip install belcore
```

## Usage

```python
from belcore import Belcore

client = Belcore()  # reads BELCORE_API_KEY

r = client.chat(
    messages=history,          # full history from your database
    system="You are a helpful assistant.",
    emotion=last_emotion,      # what the previous call returned; omit on the first turn
)

r["reply"]
save_emotion(r["emotion"])     # send it back next turn
r["memory"]                    # "long-term" | "recent"
```

`history` is a list of `{"role": "user" | "assistant", "content": str}`.

Async:

```python
from belcore import AsyncBelcore

async with AsyncBelcore() as client:
    r = await client.chat(messages=history)
```

## How it works

You keep the conversation history in **your** database and send it with each call. Belcore picks the turns that matter from the whole history, answers, and returns the updated emotion state for you to save. Belcore does not store conversation text.

```
your DB ──history──▶ Belcore ──reply + emotion──▶ your DB
```

## Options for `chat()`

| Argument | Meaning |
|---|---|
| `system` | System prompt. |
| `model` | Underlying model id, e.g. `"openai/gpt-4o-mini"`. Omit for Belcore's default. |
| `emotion` | State returned by the previous call. Omit on the first turn. |
| `traits` | Character traits (`obsession`, `edginess`, `stability`, 0–100). |
| `intimacy_level` | Relationship level (0–10). |
| `end_user_id`, `subject_id` | Optional. Let Belcore keep the numeric emotion state for you instead of sending `emotion`. Export with `export_memory()`, delete with `delete_user()`. |

Errors from the API raise `BelcoreAPIError` with `.status` and `.message`.

## Links

- LangChain: [`langchain-belcore`](https://pypi.org/project/langchain-belcore/)
- All integrations (Vercel AI SDK, LangChain.js, MCP): https://github.com/terracore-kr/belcore-integrations
- API docs: https://belcore.xyz/developers#docs

## License

Apache-2.0
