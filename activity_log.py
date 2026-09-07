from __future__ import annotations

from datetime import datetime
from typing import Any, Callable


class ActivityLog:
    """In-memory store for activity entries."""

    SENSITIVE_KEYS = {
        "password",
        "token",
        "secret",
        "api_key",
        "authorization",
        "session",
    }

    def __init__(self, now_provider: Callable[[], datetime] | None = None):
        self._entries: list[dict[str, Any]] = []
        self._seq = 0
        self._now_provider = now_provider or (lambda: datetime.now())

    def record(
        self,
        actor: str | None,
        action: str | None,
        metadata: dict[str, Any] | None = None,
        *,
        timestamp: datetime | None = None,
    ) -> dict[str, Any]:
        if actor is None or not str(actor).strip():
            raise ValueError("actor must be a non-empty value")
        if action is None or not str(action).strip():
            raise ValueError("action must be a non-empty value")

        final_timestamp = timestamp if timestamp is not None else self._now_provider()
        clean_metadata = self._redact_metadata(metadata or {})

        entry = {
            "actor": str(actor),
            "action": str(action),
            "timestamp": final_timestamp,
            "metadata": clean_metadata,
            "_seq": self._seq,
        }
        self._entries.append(entry)
        self._seq += 1
        return self._public_entry(entry)

    def query_by_actor(self, actor: str) -> list[dict[str, Any]]:
        matches = [
            entry for entry in self._entries if entry["actor"] == actor
        ]
        matches.sort(key=lambda entry: (entry["timestamp"], entry["_seq"]), reverse=True)
        return [self._public_entry(entry) for entry in matches]

    def query_by_time_range(
        self, start: datetime, end: datetime
    ) -> list[dict[str, Any]]:
        matches = [
            entry for entry in self._entries if start <= entry["timestamp"] <= end
        ]
        matches.sort(key=lambda entry: (entry["timestamp"], entry["_seq"]))
        return [self._public_entry(entry) for entry in matches]

    def _redact_metadata(self, metadata: dict[str, Any]) -> dict[str, Any]:
        redacted: dict[str, Any] = {}
        for key, value in metadata.items():
            lower_key = str(key).lower()
            if lower_key in self.SENSITIVE_KEYS:
                redacted[str(key)] = "[REDACTED]"
            else:
                redacted[str(key)] = value
        return redacted

    @staticmethod
    def _public_entry(entry: dict[str, Any]) -> dict[str, Any]:
        public = dict(entry)
        public.pop("_seq", None)
        return public
