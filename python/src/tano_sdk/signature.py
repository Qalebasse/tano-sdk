"""Les signatures telles que l'API les calcule : v2 pour les requêtes, v1 pour les webhooks."""

from __future__ import annotations

import hashlib
import hmac
import re
from typing import NamedTuple

_KEY = re.compile(r"^tano_(prod|sandbox|test)_([a-z0-9]{8})_([a-z0-9]{32})$")


class ParsedKey(NamedTuple):
    environment: str
    secret: str


def parse_key(key: str) -> ParsedKey | None:
    match = _KEY.match(key.strip())
    return None if match is None else ParsedKey(match.group(1), match.group(3))


def request_signature(secret: str, timestamp: str, method: str, target: str, body: bytes) -> str:
    """`v2=` + hex(HMAC-SHA256(secret, horodatage.MÉTHODE.cible.corps))."""
    message = f"{timestamp}.{method.upper()}.{target}.".encode() + body
    return "v2=" + hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def delivery_signature(secret: str, timestamp: str, body: bytes) -> str:
    """`v1=` + hex(HMAC-SHA256(secret_webhook, horodatage.corps))."""
    message = timestamp.encode() + b"." + body
    return "v1=" + hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
