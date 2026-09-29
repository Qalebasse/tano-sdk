# tano-sdk

The official Python library for the [Tano](https://docs.tano.africa) identity verification API.

- Request signing (HMAC-SHA256, v2) and replay protection handled for you
- Idempotency keys on every write, kept across retries
- Automatic retries on network errors, `429` and `5xx`, honouring `Retry-After`
- Webhook signature verification
- Typed (`py.typed`), zero dependencies — the standard library only

## Requirements

Python 3.9 or later.

## Installation

```bash
pip install tano-sdk
```

## Quick start

```python
import os
from tano_sdk import Tano

tano = Tano(os.environ["TANO_API_KEY"])  # tano_sandbox_… or tano_prod_…

case = tano.cases.create(
    flow_name="onboarding_individual_ci",
    country="CI",
    external_ref="customer-42",  # one case per intent, even if the request is replayed
    declared={"surname": "KOUASSI", "given_names": "Awa"},
)

session = tano.sessions.create(
    case_id=case["id"],
    locale="fr",
    return_url="https://your-site.example/verification/done",
)
print(session["url"])  # returned once — do not store it

results = tano.cases.results(case["id"])
if results["state"] == "approved":
    ...
```

## Configuration

```python
Tano(
    api_key,  # required — the environment is read from the key prefix
    base_url="https://api.tano.africa",
    timeout=30.0,  # seconds, per attempt
    max_retries=2,
    transport=urllib_transport,  # replaceable: any callable HttpRequest -> HttpResponse
)
```

## API reference

| Method | Endpoint | Notes |
| --- | --- | --- |
| `cases.create(flow_name, country, external_ref=None, declared=None, idempotency_key=None)` | `POST /v1/cases` | Signed |
| `cases.retrieve(case_id)` | `GET /v1/cases/{id}` | Status, steps and decision |
| `cases.list(q, external_ref, status, country, created_after, created_before, limit, cursor)` | `GET /v1/cases` | One page: `data`, `has_more`, `next_cursor` |
| `cases.list_all(**filters)` | — | Iterates over every page |
| `cases.results(case_id)` | `GET /v1/cases/{id}/results` | `state`, decision, resubmission, checks, pieces — no personal data |
| `cases.data(case_id)` | `GET /v1/cases/{id}/data` | Personal data. Requires `personal_data`; every read is logged |
| `cases.image(case_id, piece_id)` | `GET /v1/cases/{id}/images/{piece_id}` | `(content_type, bytes)`. Requires `personal_data` |
| `cases.decide(case_id, outcome, reason_code, steps=None, comment=None)` | `POST /v1/cases/{id}/decision` | `approve`, `reject` or `resubmit` a case in review. Requires `decisions` |
| `cases.erase(case_id)` | `POST /v1/cases/{id}/erasure` | Erase personal data of a closed case. Requires `personal_data` |
| `sessions.create(case_id, locale=None, lifetime_minutes=None, return_url=None)` | `POST /v1/sessions` | Journey `url`, returned once |
| `sandbox.submit(case_id)` | `POST /v1/sandbox/cases/{id}/submit` | Sandbox keys only; the declared surname picks the outcome |
| `request(method, path, body=None, query=None, idempotency_key=None)` | any | Raw call with signing, idempotency and retries |

`results["state"]` is one of `awaiting_applicant`, `processing`, `in_review`,
`resubmission_requested` (not a rejection), `approved`, `rejected` (final), `expired`,
`abandoned`.

## Webhooks

Pass the **raw** body (`request.get_data()`, `await request.body()`).

```python
from flask import Flask, abort, request
from tano_sdk import WebhookSignatureError, verify_webhook

app = Flask(__name__)


@app.post("/webhooks/tano")
def tano_webhook():
    try:
        event = verify_webhook(
            request.get_data(), request.headers, os.environ["TANO_WEBHOOK_SECRET"]
        )
    except WebhookSignatureError:
        abort(401)
    # Deduplicate on event["delivery_id"], enqueue the work, answer fast.
    return "", 204
```

## Errors

| Exception | When | Useful attributes |
| --- | --- | --- |
| `TanoApiError` | The API answered with an error | `status`, `type`, `code` (stable), `field`, `request_id`, `doc_url` |
| `TanoConnectionError` | No response after retries | Replaying with the same `idempotency_key` is safe |
| `WebhookSignatureError` | A delivery failed verification | Answer `401` |
| `TanoError` | Base class, e.g. malformed API key | |

## Support

Documentation: https://docs.tano.africa · Support: support@tano.africa · Security:
security@tano.africa

## License

MIT © Qalebasse
