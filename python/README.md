# tano-sdk

La bibliothèque Python officielle de l'API de vérification d'identité
[Tano](https://docs.tano.africa).

- Signature des requêtes (HMAC-SHA256, v2) et protection contre le rejeu, prises en charge
- Clé d'idempotence sur chaque écriture, conservée d'un réessai à l'autre
- Réessais automatiques sur coupure réseau, `429` et `5xx`, en respectant `Retry-After`
- Vérification de la signature des webhooks
- Typée (`py.typed`), sans dépendance : la bibliothèque standard seulement

## Prérequis

Python 3.9 ou plus récent.

## Installation

```bash
pip install tano-sdk
```

## Démarrage rapide

```python
import os
from tano_sdk import Tano

tano = Tano(os.environ["TANO_API_KEY"])  # tano_sandbox_… ou tano_prod_…

case = tano.cases.create(
    flow_name="onboarding_individual_ci",
    country="CI",
    external_ref="customer-42",  # un seul dossier par intention, même rejouée
    declared={"surname": "KOUASSI", "given_names": "Awa"},
)

session = tano.sessions.create(
    case_id=case["id"],
    locale="fr",
    return_url="https://votre-site.example/verification/terminee",
)
print(session["url"])  # rendue une seule fois — ne la stockez pas

results = tano.cases.results(case["id"])
if results["state"] == "approved":
    ...
```

## Configuration

```python
Tano(
    api_key,  # obligatoire — l'environnement se lit dans le préfixe de la clé
    base_url="https://api.tano.africa",
    timeout=30.0,  # secondes, par tentative
    max_retries=2,
    transport=urllib_transport,  # remplaçable : tout appelable HttpRequest -> HttpResponse
)
```

## Référence de l'API

| Méthode | Route | Notes |
| --- | --- | --- |
| `cases.create(flow_name, country, external_ref=None, declared=None, idempotency_key=None)` | `POST /v1/cases` | Signée |
| `cases.retrieve(case_id)` | `GET /v1/cases/{id}` | État, étapes et décision |
| `cases.list(q, external_ref, status, country, created_after, created_before, limit, cursor)` | `GET /v1/cases` | Une page : `data`, `has_more`, `next_cursor` |
| `cases.list_all(**filters)` | — | Parcourt toutes les pages |
| `cases.results(case_id)` | `GET /v1/cases/{id}/results` | `state`, décision, reprise, contrôles, pièces — sans donnée personnelle |
| `cases.data(case_id)` | `GET /v1/cases/{id}/data` | Données personnelles. Permission `personal_data` ; chaque lecture est journalisée |
| `cases.image(case_id, piece_id)` | `GET /v1/cases/{id}/images/{piece_id}` | `(content_type, bytes)`. Permission `personal_data` |
| `cases.decide(case_id, outcome, reason_code, steps=None, comment=None)` | `POST /v1/cases/{id}/decision` | `approve`, `reject` ou `resubmit` un dossier en revue. Permission `decisions` |
| `cases.erase(case_id)` | `POST /v1/cases/{id}/erasure` | Effacer les données personnelles d'un dossier clos. Permission `personal_data` |
| `sessions.create(case_id, locale=None, lifetime_minutes=None, return_url=None)` | `POST /v1/sessions` | L'`url` du parcours, rendue une seule fois |
| `sandbox.submit(case_id)` | `POST /v1/sandbox/cases/{id}/submit` | Clés de bac à sable seulement ; le nom de famille déclaré choisit l'issue |
| `request(method, path, body=None, query=None, idempotency_key=None)` | toute route | Appel brut, avec signature, idempotence et réessais |

`results["state"]` vaut `awaiting_applicant`, `processing`, `in_review`,
`resubmission_requested` (pas un refus), `approved`, `rejected` (définitif), `expired` ou
`abandoned`.

## Webhooks

Passez le corps **brut** (`request.get_data()`, `await request.body()`).

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
    # Écartez les doublons avec event["delivery_id"], mettez en file, répondez vite.
    return "", 204
```

## Erreurs

| Exception | Quand | Attributs utiles |
| --- | --- | --- |
| `TanoApiError` | L'API a répondu une erreur | `status`, `type`, `code` (stable), `field`, `request_id`, `doc_url` |
| `TanoConnectionError` | Pas de réponse après les réessais | Rejouer avec la même `idempotency_key` est sans risque |
| `WebhookSignatureError` | Une livraison n'a pas passé la vérification | Répondez `401` |
| `TanoError` | Classe de base, par exemple une clé mal formée | |

## Support

Documentation : https://docs.tano.africa · Support : support@tano.africa · Sécurité :
security@tano.africa

## Licence

MIT © Qalebasse
