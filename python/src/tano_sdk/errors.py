"""Les erreurs du SDK. Testez le `code` d'une erreur d'API : il est stable, le message non."""

from __future__ import annotations

from typing import Any


class TanoError(Exception):
    """Tout ce que le SDK lève en dérive."""


class TanoApiError(TanoError):
    """Une réponse d'erreur de l'API."""

    def __init__(self, status: int, body: dict[str, Any], request_id: str | None) -> None:
        super().__init__(body.get("message") or f"Erreur {status} de l'API Tano.")
        self.status = status
        self.type: str = body.get("type") or "api_error"
        self.code: str = body.get("code") or "unknown"
        self.request_id: str | None = body.get("request_id") or request_id
        self.field: str | None = body.get("field")
        self.doc_url: str | None = body.get("doc_url")


class TanoConnectionError(TanoError):
    """L'API n'a pas répondu. Avec la même clé d'idempotence, rejouer est sans risque."""


class WebhookSignatureError(TanoError):
    """Une livraison dont la signature ne tient pas : répondez 401 et ne la traitez pas."""
