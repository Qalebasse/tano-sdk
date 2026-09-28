"""Vérifier une livraison de webhook et la lire."""

from __future__ import annotations

import hmac
import json
import time
from collections.abc import Mapping
from typing import Any

from tano_sdk.errors import WebhookSignatureError
from tano_sdk.signature import delivery_signature


def _header(headers: Mapping[str, str], name: str) -> str | None:
    wanted = name.lower()
    for key, value in headers.items():
        if key.lower() == wanted:
            return value
    return None


def verify_webhook(
    body: bytes | str,
    headers: Mapping[str, str],
    secret: str,
    *,
    tolerance_seconds: int = 300,
    now: float | None = None,
) -> dict[str, Any]:
    """Vérifier la signature d'une livraison et rendre l'événement, `delivery_id` compris.

    Passez le **corps brut** (`request.get_data()`, `await request.body()`), jamais un objet déjà
    désérialisé : la signature porte sur les octets reçus. Lève `WebhookSignatureError`.
    """
    raw = body.encode() if isinstance(body, str) else body
    timestamp = _header(headers, "X-Tano-Timestamp")
    signature = _header(headers, "X-Tano-Signature")
    if timestamp is None or signature is None or not timestamp.isdigit():
        raise WebhookSignatureError("En-têtes X-Tano-Timestamp et X-Tano-Signature attendus.")
    instant = time.time() if now is None else now
    if abs(instant - int(timestamp)) > tolerance_seconds:
        raise WebhookSignatureError("Livraison trop ancienne ou horloge décalée.")
    if not hmac.compare_digest(signature, delivery_signature(secret, timestamp, raw)):
        raise WebhookSignatureError("Signature invalide : vérifiez le secret et le corps brut.")
    event: dict[str, Any] = json.loads(raw)
    event["delivery_id"] = _header(headers, "X-Tano-Delivery") or ""
    return event
