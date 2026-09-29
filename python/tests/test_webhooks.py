from __future__ import annotations

import pytest

from tano_sdk import WebhookSignatureError, verify_webhook

# Vecteur calculé par tano-core (`delivery_signature`).
BODY = b'{"type":"case.decided"}'
HEADERS = {
    "X-Tano-Timestamp": "1790000000",
    "X-Tano-Signature": "v1=8e5d28525962ab99896db695a13c979052990b0a0edfbb011e5c94485bdd49d8",
    "X-Tano-Delivery": "dlv_1",
}
NOW = 1790000030.0


def test_api_delivery_is_accepted() -> None:
    event = verify_webhook(BODY, HEADERS, "whsec_exemple", now=NOW)
    assert event == {"type": "case.decided", "delivery_id": "dlv_1"}


def test_headers_are_case_insensitive() -> None:
    lower = {k.lower(): v for k, v in HEADERS.items()}
    assert verify_webhook(BODY.decode(), lower, "whsec_exemple", now=NOW)["type"] == "case.decided"


@pytest.mark.parametrize(
    ("body", "headers", "secret"),
    [
        (BODY, HEADERS, "autre"),
        (b'{"type":"case.decided" }', HEADERS, "whsec_exemple"),
        (BODY, {"X-Tano-Timestamp": "1790000000"}, "whsec_exemple"),
    ],
)
def test_tampered_delivery_is_rejected(body: bytes, headers: dict[str, str], secret: str) -> None:
    with pytest.raises(WebhookSignatureError):
        verify_webhook(body, headers, secret, now=NOW)


def test_stale_delivery_is_rejected() -> None:
    with pytest.raises(WebhookSignatureError, match="ancienne"):
        verify_webhook(BODY, HEADERS, "whsec_exemple", now=NOW + 600)
