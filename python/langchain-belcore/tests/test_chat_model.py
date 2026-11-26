import json

import httpx
import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from belcore import AsyncBelcore, Belcore
from langchain_belcore import ChatBelcore

OK = {"reply": "Your dentist is Dr. Okafor.", "emotion": {"longing": 10, "sulkiness": 0, "emotionUpdatedAt": 1},
      "memory": "long-term", "model": "openai/gpt-4o-mini", "usage": {"inputTokens": 120, "outputTokens": 8}}
MSGS = [SystemMessage("Be brief."), HumanMessage("My dentist is Dr. Okafor."), AIMessage("Noted."), HumanMessage("Who is my dentist?")]


def handler(calls):
    def h(req):
        calls.append(req)
        return httpx.Response(200, json=OK)
    return h


def model_with(calls, **kw):
    m = ChatBelcore(api_key="sk_test_x", **kw)
    m._client = Belcore("sk_test_x", http_client=httpx.Client(transport=httpx.MockTransport(handler(calls))))
    m._aclient = AsyncBelcore("sk_test_x", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler(calls))))
    return m


def test_invoke_maps_messages_and_metadata():
    calls = []
    m = model_with(calls, model="openai/gpt-4o-mini", belcore={"intimacy_level": 2})
    res = m.invoke(MSGS, belcore={"emotion": {"longing": 3}})
    assert "Okafor" in res.content
    assert res.response_metadata["belcore"]["memory"] == "long-term"
    assert res.response_metadata["belcore"]["emotion"]["longing"] == 10
    assert res.usage_metadata["total_tokens"] == 128
    body = json.loads(calls[0].content)
    assert body["system"] == "Be brief."
    assert body["messages"] == [
        {"role": "user", "content": "My dentist is Dr. Okafor."},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": "Who is my dentist?"},
    ]
    assert body["model"] == "openai/gpt-4o-mini" and body["emotion"] == {"longing": 3} and body["intimacyLevel"] == 2


def test_unknown_option_rejected():
    m = model_with([])
    with pytest.raises(ValueError, match="Unknown Belcore option"):
        m.invoke(MSGS, belcore={"temperature": 0})


@pytest.mark.asyncio
async def test_ainvoke():
    calls = []
    res = await model_with(calls).ainvoke([HumanMessage("Who is my dentist?")])
    assert res.content.startswith("Your dentist")
    assert "model" not in json.loads(calls[0].content)


def test_reads_env_key(monkeypatch):
    monkeypatch.setenv("BELCORE_API_KEY", "sk_env")
    m = ChatBelcore()
    assert m._sync()._headers["Authorization"] == "Bearer sk_env"
