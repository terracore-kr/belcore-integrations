"""Belcore as a LangChain chat model.

    from langchain_belcore import ChatBelcore

    llm = ChatBelcore(model="openai/gpt-4o-mini")
    res = llm.invoke(history_from_your_db, belcore={"emotion": last_emotion})
    res.response_metadata["belcore"]["emotion"]   # save for the next call
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from belcore import AsyncBelcore, Belcore, ChatResponse
from langchain_core.callbacks import AsyncCallbackManagerForLLMRun, CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from pydantic import ConfigDict, Field, PrivateAttr, SecretStr

__all__ = ["ChatBelcore"]
__version__ = "0.1.0"

# Per-call options accepted under `belcore={...}` (and as defaults on the model).
_OPTION_KEYS = {"emotion", "traits", "intimacy_level", "advance", "end_user_id", "subject_id"}


def _text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    parts = []
    for c in content:
        if isinstance(c, str):
            parts.append(c)
        elif isinstance(c, dict) and isinstance(c.get("text"), str):
            parts.append(c["text"])
    return "\n".join(parts)


def _convert(messages: List[BaseMessage]) -> Tuple[Optional[str], List[Dict[str, str]]]:
    systems: List[str] = []
    out: List[Dict[str, str]] = []
    for m in messages:
        if m.type == "system":
            systems.append(_text(m))
        elif m.type == "human":
            out.append({"role": "user", "content": _text(m)})
        elif m.type == "ai":
            out.append({"role": "assistant", "content": _text(m)})
    return ("\n\n".join(systems) if systems else None), out


class ChatBelcore(BaseChatModel):
    """Chat model backed by the Belcore API.

    Send the full conversation history you keep in your database. Belcore picks
    the turns that matter from the whole history and answers. The returned
    message carries ``response_metadata["belcore"]`` with the new ``emotion``
    state (save it and pass it back next turn) and ``memory``
    (``"long-term"`` or ``"recent"``).
    """

    model: Optional[str] = None
    """Underlying model id, e.g. ``"openai/gpt-4o-mini"``. Omit for Belcore's default."""
    api_key: Optional[SecretStr] = None
    """Defaults to the ``BELCORE_API_KEY`` environment variable."""
    base_url: Optional[str] = None
    timeout: float = 60.0
    belcore: Dict[str, Any] = Field(default_factory=dict)
    """Default options sent with every call: emotion, traits, intimacy_level, advance, end_user_id, subject_id."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    _client: Optional[Belcore] = PrivateAttr(default=None)
    _aclient: Optional[AsyncBelcore] = PrivateAttr(default=None)

    @property
    def _llm_type(self) -> str:
        return "belcore"

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        return {"model": self.model}

    def _client_kw(self) -> Dict[str, Any]:
        return {
            "api_key": self.api_key.get_secret_value() if self.api_key else None,
            "base_url": self.base_url,
            "timeout": self.timeout,
        }

    def _sync(self) -> Belcore:
        if self._client is None:
            self._client = Belcore(**self._client_kw())
        return self._client

    def _async(self) -> AsyncBelcore:
        if self._aclient is None:
            self._aclient = AsyncBelcore(**self._client_kw())
        return self._aclient

    def _request(self, messages: List[BaseMessage], kwargs: Dict[str, Any]) -> Dict[str, Any]:
        options = {**self.belcore, **(kwargs.get("belcore") or {})}
        unknown = set(options) - _OPTION_KEYS
        if unknown:
            raise ValueError(f"Unknown Belcore option(s): {sorted(unknown)}. Allowed: {sorted(_OPTION_KEYS)}")
        system, msgs = _convert(messages)
        return {"messages": msgs, "system": system, "model": self.model, **options}

    @staticmethod
    def _result(res: ChatResponse) -> ChatResult:
        usage = res.get("usage") or {}
        meta = {"belcore": {"emotion": res.get("emotion"), "memory": res.get("memory"), "degraded": res.get("degraded", False)}}
        if res.get("model"):
            meta["model_name"] = res["model"]
        message = AIMessage(content=res.get("reply", ""), response_metadata=meta)
        if usage.get("inputTokens") is not None and usage.get("outputTokens") is not None:
            message.usage_metadata = {
                "input_tokens": usage["inputTokens"],
                "output_tokens": usage["outputTokens"],
                "total_tokens": usage["inputTokens"] + usage["outputTokens"],
            }
        return ChatResult(generations=[ChatGeneration(message=message)])

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        req = self._request(messages, kwargs)
        return self._result(self._sync().chat(req.pop("messages"), **req))

    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        req = self._request(messages, kwargs)
        return self._result(await self._async().chat(req.pop("messages"), **req))
