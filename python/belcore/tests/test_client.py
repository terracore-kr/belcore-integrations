import json

import httpx
import pytest

from belcore import AsyncBelcore, Belcore, BelcoreAPIError

OK = {"reply": "Your dentist is Dr. Okafor.", "emotion": {"longing": 10, "sulkiness": 0, "emotionUpdatedAt": 1}, "memory": "long-term", "model": "openai/gpt-4o-mini"}
HIST = [{"role": "user", "content": "My dentist is Dr. Okafor."}, {"role": "assistant", "content": "Noted."}, {"role": "user", "content": "Who is my dentist?"}]


def transport(status=200, body=OK, calls=None):
    def handler(req: httpx.Request) -> httpx.Response:
        if calls is not None:
            calls.append(req)
        return httpx.Response(status, json=body)
    return httpx.MockTransport(handler)


def test_chat_sends_key_and_body():
    calls = []
    c = Belcore("sk_test_x", http_client=httpx.Client(transport=transport(calls=calls)))
    r = c.chat(HIST, system="be brief", emotion={"longing": 3}, intimacy_level=2)
    assert "Okafor" in r["reply"] and r["memory"] == "long-term"
    req = calls[0]
    assert str(req.url) == "https://belcore.xyz/api/v1/chat"
    assert req.headers["Authorization"] == "Bearer sk_test_x"
    body = json.loads(req.content)
    assert body["messages"] == HIST and body["system"] == "be brief"
    assert body["emotion"] == {"longing": 3} and body["intimacyLevel"] == 2
    assert "model" not in body and "endUserId" not in body


def test_error_status_raises():
    c = Belcore("k", http_client=httpx.Client(transport=transport(401, {"error": "Missing API key."})))
    with pytest.raises(BelcoreAPIError) as e:
        c.chat(HIST)
    assert e.value.status == 401 and "Missing API key" in e.value.message


def test_requires_user_message():
    c = Belcore("k", http_client=httpx.Client(transport=transport()))
    with pytest.raises(ValueError):
        c.chat([{"role": "assistant", "content": "hi"}])


def test_key_checks(monkeypatch):
    monkeypatch.delenv("BELCORE_API_KEY", raising=False)
    with pytest.raises(ValueError, match="missing"):
        Belcore()
    with pytest.raises(ValueError, match="looks wrong"):
        Belcore("여기에키")
    monkeypatch.setenv("BELCORE_API_KEY", " sk_env ")
    calls = []
    Belcore(http_client=httpx.Client(transport=transport(calls=calls))).usage()
    assert calls[0].headers["Authorization"] == "Bearer sk_env"


def test_export_and_delete_params():
    calls = []
    c = Belcore("k", http_client=httpx.Client(transport=transport(body={}, calls=calls)))
    c.export_memory("u1", subject_id="s1", history=False)
    c.delete_user("u1")
    assert calls[0].url.path == "/api/v1/memory/export" and dict(calls[0].url.params) == {"endUserId": "u1", "subjectId": "s1", "history": "0"}
    assert calls[1].method == "DELETE" and dict(calls[1].url.params) == {"endUserId": "u1"}


@pytest.mark.asyncio
async def test_async_chat():
    calls = []
    async with AsyncBelcore("k", http_client=httpx.AsyncClient(transport=transport(calls=calls))) as c:
        r = await c.chat(HIST, model="openai/gpt-4o-mini")
    assert r["reply"].startswith("Your dentist")
    assert json.loads(calls[0].content)["model"] == "openai/gpt-4o-mini"
