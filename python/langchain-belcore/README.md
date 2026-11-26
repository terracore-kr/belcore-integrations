# langchain-belcore

[LangChain](https://python.langchain.com) chat model for [Belcore](https://belcore.xyz): long-term memory and an emotion state for your chat app.

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

## Install

```bash
pip install langchain-belcore
```

## Usage

```python
from langchain_belcore import ChatBelcore

llm = ChatBelcore(model="openai/gpt-4o-mini")

res = llm.invoke(
    history,                                  # full history from your database (LangChain messages)
    belcore={"emotion": last_emotion},        # omit on the first turn
)

res.content
save_emotion(res.response_metadata["belcore"]["emotion"])   # send it back next turn
res.response_metadata["belcore"]["memory"]                  # "long-term" | "recent"
```

`ainvoke` works too. System messages become Belcore's system prompt.

## How it works

You keep the conversation history in **your** database and send it with each call. Belcore picks the turns that matter from the whole history, answers, and returns the updated emotion state for you to save. Belcore does not store conversation text.

## Options

Pass under `belcore={...}` per call, or as defaults with `ChatBelcore(belcore={...})`:

| Key | Meaning |
|---|---|
| `emotion` | State returned by the previous call. |
| `traits` | Character traits (`obsession`, `edginess`, `stability`, 0–100). |
| `intimacy_level` | Relationship level (0–10). |
| `end_user_id`, `subject_id` | Optional. Let Belcore keep the numeric emotion state for you. |

## Limits (v0.1)

- Text only. Non-text content parts are dropped.
- Tool calling, streaming token by token, `temperature` and `max_tokens` are not supported.

## Links

- Plain Python client: [`belcore`](https://pypi.org/project/belcore/)
- All integrations: https://github.com/terracore-kr/belcore-integrations

## License

Apache-2.0
