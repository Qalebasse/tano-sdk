# @tano-africa/node

[![npm](https://img.shields.io/npm/v/@tano-africa/node.svg)](https://www.npmjs.com/package/@tano-africa/node)
[![license](https://img.shields.io/npm/l/@tano-africa/node.svg)](LICENSE)

The official Node.js library for the [Tano](https://docs.tano.africa) identity verification API.

- Request signing (HMAC-SHA256, v2) and replay protection handled for you
- Idempotency keys on every write, kept across retries
- Automatic retries on network errors, `429` and `5xx`, honouring `Retry-After`
- Webhook signature verification
- Fully typed, zero dependencies, ESM

## Requirements

Node.js 20 or later.

## Installation

```bash
npm install @tano-africa/node
```

## Quick start

```ts
import { Tano } from "@tano-africa/node";

const tano = new Tano({ apiKey: process.env.TANO_API_KEY! }); // tano_sandbox_… or tano_prod_…

// 1. Open a case.
const kase = await tano.cases.create({
  flow_name: "onboarding_individual_ci",
  country: "CI",
  external_ref: "customer-42", // your reference: one case per intent, even if the request is replayed
  declared: { surname: "KOUASSI", given_names: "Awa" },
});

// 2. Create a journey session and hand its URL to your web page or mobile app.
const session = await tano.sessions.create({
  case_id: kase.id,
  locale: "fr",
  return_url: "https://your-site.example/verification/done",
});
console.log(session.url); // returned once — do not store it

// 3. Later, read the outcome.
const results = await tano.cases.results(kase.id);
if (results.state === "approved") {
  // …
}
```

## Configuration

```ts
new Tano({
  apiKey: string,          // required — the environment is read from the key prefix
  baseUrl?: string,        // default https://api.tano.africa
  timeoutMs?: number,      // per attempt, default 30 000
  maxRetries?: number,     // default 2
  fetch?: typeof fetch,    // custom fetch implementation
});
```

`tano.environment` is `"prod"`, `"sandbox"` or `"test"`, from the key.

## API reference

### Cases

| Method | Endpoint | Notes |
| --- | --- | --- |
| `cases.create(params, options?)` | `POST /v1/cases` | Signed. `flow_name`, `country`, `external_ref?`, `declared?` |
| `cases.retrieve(id)` | `GET /v1/cases/{id}` | Status, steps and decision |
| `cases.list(params?)` | `GET /v1/cases` | `q`, `external_ref`, `status`, `country`, `created_after`, `created_before`, `limit`, `cursor` |
| `cases.listAll(params?)` | — | Async iterator over every page |
| `cases.results(id)` | `GET /v1/cases/{id}/results` | `state`, decision, resubmission, checks, pieces — no personal data |
| `cases.data(id)` | `GET /v1/cases/{id}/data` | Personal data. Requires the `personal_data` permission; every read is logged |
| `cases.image(id, pieceId)` | `GET /v1/cases/{id}/images/{pieceId}` | `{ contentType, data: Buffer }`. Requires `personal_data` |
| `cases.decide(id, params)` | `POST /v1/cases/{id}/decision` | `approve`, `reject` or `resubmit` a case in review. Requires `decisions` |
| `cases.erase(id)` | `POST /v1/cases/{id}/erasure` | Erase personal data of a closed case. Requires `personal_data` |

`results.state` is one of `awaiting_applicant`, `processing`, `in_review`,
`resubmission_requested` (not a rejection — the person must retake photos), `approved`,
`rejected` (final), `expired`, `abandoned`.

### Sessions

| Method | Endpoint | Notes |
| --- | --- | --- |
| `sessions.create(params, options?)` | `POST /v1/sessions` | `case_id`, `locale?`, `lifetime_minutes?` (1–60), `return_url?` (HTTPS, no query or fragment) |

### Sandbox

| Method | Endpoint | Notes |
| --- | --- | --- |
| `sandbox.submit(caseId)` | `POST /v1/sandbox/cases/{id}/submit` | Sandbox keys only. The declared surname picks the outcome: `TESTPASS`, `TESTREVIEW`, `TESTFAIL`, `TESTSANCTION`, `TESTSLOW`, `TESTDOWN` |

### Raw requests

`tano.request(method, path, body?, options?)` calls an endpoint the library does not wrap yet, with
the same signing, idempotency and retries.

### Request options

Every method accepts `{ idempotencyKey?: string, signal?: AbortSignal }`. Reuse the same
`idempotencyKey` to safely replay the same intent.

## Webhooks

Pass the **raw** body — a re-serialised object no longer matches the signature.

```ts
import express from "express";
import { verifyWebhook, WebhookSignatureError } from "@tano-africa/node";

app.post("/webhooks/tano", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = verifyWebhook(req.body, req.headers, process.env.TANO_WEBHOOK_SECRET!);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return res.sendStatus(401);
    throw error;
  }
  // Deduplicate on event.delivery_id, enqueue the work, answer fast.
  res.sendStatus(204);
});
```

`verifyWebhook(body, headers, secret, { toleranceSeconds?: number = 300 })` returns
`{ type, occurred_at, object, data, delivery_id }`. For case events, `object` also carries
`external_ref`, `flow_name` and `environment`.

## Errors

| Class | When | Useful fields |
| --- | --- | --- |
| `TanoApiError` | The API answered with an error | `status`, `type`, `code` (stable — branch on it), `field`, `requestId`, `docUrl` |
| `TanoConnectionError` | No response after retries | Replaying with the same `idempotencyKey` is safe |
| `WebhookSignatureError` | A delivery failed verification | Answer `401` |
| `TanoError` | Base class, e.g. malformed API key | |

Every error code is documented at `https://docs.tano.africa/errors/<code>`.

## Support

- Documentation: https://docs.tano.africa
- Support: support@tano.africa
- Security: security@tano.africa

## License

[MIT](LICENSE) © Qalebasse
