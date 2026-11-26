"""Python client for the Belcore API.

You keep the conversation history (and the emotion state Belcore returns) in
YOUR database and send it with each call. Belcore picks the turns that matter
from the whole history, answers, and returns the updated emotion state.
Belcore does not store conversation text.

    from belcore import Belcore

    client = Belcore()                      # reads BELCORE_API_KEY
    r = client.chat(messages=history, emotion=last_emotion)
    r["reply"], r["emotion"], r["memory"]   # "long-term" | "recent"
"""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Literal, Mapping, Optional, TypedDict

import httpx

__all__ = ["Belcore", "AsyncBelcore", "BelcoreAPIError", "Message", "ChatResponse", "DEFAULT_BASE_URL"]
__version__ = "0.1.0"

DEFAULT_BASE_URL = "https://belcore.xyz/api/v1"
_KEY_RE = re.compile(r"^[\x21-\x7e]+$")


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


class ChatResponse(TypedDict, total=False):
    reply: str
    emotion: Dict[str, float]
    directiveActive: bool
    model: str
    usage: Dict[str, int]
    degraded: bool
    memory: Literal["long-term", "recent"]
    stateful: bool
    saved: bool


class BelcoreAPIError(Exception):
    """The Belcore API answered with an error status."""

    def __init__(self, status: int, message: str, body: Any = None) -> None:
        super().__init__(f"Belcore API {status}: {message}")
        self.status = status
        self.message = message
        self.body = body


def _key(api_key: Optional[str]) -> str:
    key = api_key if api_key is not None else os.environ.get("BELCORE_API_KEY")
    if not key:
        raise ValueError("Belcore API key missing: pass api_key=... or set BELCORE_API_KEY.")
    key = key.strip()
    if not _KEY_RE.match(key):
        raise ValueError(
            "Belcore API key looks wrong: it must be the sk_... key exactly as issued "
            "(no spaces or non-ASCII characters)."
        )
    return key


def _chat_body(messages: List[Mapping[str, str]], **fields: Any) -> Dict[str, Any]:
    if not isinstance(messages, list) or not any(m.get("role") == "user" for m in messages):
        raise ValueError("chat(): 'messages' must contain at least one user message.")
    body: Dict[str, Any] = {"messages": [{"role": m["role"], "content": m["content"]} for m in messages]}
    body.update({k: v for k, v in fields.items() if v is not None})
    return body


def _parse(res: httpx.Response) -> Any:
    try:
        data = res.json() if res.content else None
    except ValueError:
        data = None
    if res.status_code >= 400:
        msg = data.get("error") if isinstance(data, dict) else None
        raise BelcoreAPIError(res.status_code, msg if isinstance(msg, str) else (res.reason_phrase or "request failed"), data if data is not None else res.text)
    return data


class _Base:
    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: Optional[str] = None,
        timeout: float = 60.0,
        headers: Optional[Mapping[str, str]] = None,
    ) -> None:
        self._headers = {"Authorization": f"Bearer {_key(api_key)}", "User-Agent": f"belcore-python/{__version__}", **(headers or {})}
        self._base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._timeout = timeout


class Belcore(_Base):
    """Synchronous client."""

    def __init__(self, api_key: Optional[str] = None, *, http_client: Optional[httpx.Client] = None, **kw: Any) -> None:
        super().__init__(api_key, **kw)
        self._http = http_client or httpx.Client(timeout=self._timeout)

    def _request(self, method: str, path: str, *, json: Any = None, params: Any = None) -> Any:
        return _parse(self._http.request(method, f"{self._base_url}{path}", json=json, params=params, headers=self._headers))

    def chat(
        self,
        messages: List[Mapping[str, str]],
        *,
        system: Optional[str] = None,
        model: Optional[str] = None,
        emotion: Optional[Mapping[str, float]] = None,
        traits: Optional[Mapping[str, float]] = None,
        intimacy_level: Optional[int] = None,
        advance: Optional[bool] = None,
        end_user_id: Optional[str] = None,
        subject_id: Optional[str] = None,
    ) -> ChatResponse:
        """One chat turn. Send the full history you keep; Belcore picks the relevant long-term context."""
        body = _chat_body(messages, system=system, model=model, emotion=emotion, traits=traits,
                          intimacyLevel=intimacy_level, advance=advance, endUserId=end_user_id, subjectId=subject_id)
        return self._request("POST", "/chat", json=body)

    def export_memory(self, end_user_id: str, *, subject_id: Optional[str] = None, history: bool = True) -> Any:
        """Download what Belcore holds for an end user (only used if you opted into end_user_id mode)."""
        params = {"endUserId": end_user_id, **({"subjectId": subject_id} if subject_id else {}), **({} if history else {"history": "0"})}
        return self._request("GET", "/memory/export", params=params)

    def delete_user(self, end_user_id: str) -> Any:
        """Delete everything Belcore holds for an end user."""
        return self._request("DELETE", "/memory/user", params={"endUserId": end_user_id})

    def usage(self) -> Any:
        return self._request("GET", "/usage")

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "Belcore":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


class AsyncBelcore(_Base):
    """Async client (same methods, awaitable)."""

    def __init__(self, api_key: Optional[str] = None, *, http_client: Optional[httpx.AsyncClient] = None, **kw: Any) -> None:
        super().__init__(api_key, **kw)
        self._http = http_client or httpx.AsyncClient(timeout=self._timeout)

    async def _request(self, method: str, path: str, *, json: Any = None, params: Any = None) -> Any:
        return _parse(await self._http.request(method, f"{self._base_url}{path}", json=json, params=params, headers=self._headers))

    async def chat(
        self,
        messages: List[Mapping[str, str]],
        *,
        system: Optional[str] = None,
        model: Optional[str] = None,
        emotion: Optional[Mapping[str, float]] = None,
        traits: Optional[Mapping[str, float]] = None,
        intimacy_level: Optional[int] = None,
        advance: Optional[bool] = None,
        end_user_id: Optional[str] = None,
        subject_id: Optional[str] = None,
    ) -> ChatResponse:
        body = _chat_body(messages, system=system, model=model, emotion=emotion, traits=traits,
                          intimacyLevel=intimacy_level, advance=advance, endUserId=end_user_id, subjectId=subject_id)
        return await self._request("POST", "/chat", json=body)

    async def export_memory(self, end_user_id: str, *, subject_id: Optional[str] = None, history: bool = True) -> Any:
        params = {"endUserId": end_user_id, **({"subjectId": subject_id} if subject_id else {}), **({} if history else {"history": "0"})}
        return await self._request("GET", "/memory/export", params=params)

    async def delete_user(self, end_user_id: str) -> Any:
        return await self._request("DELETE", "/memory/user", params={"endUserId": end_user_id})

    async def usage(self) -> Any:
        return await self._request("GET", "/usage")

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncBelcore":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()
