# tano-sdk

Le SDK serveur de Tano pour Python (3.9 et plus). Il signe les requêtes, pose les clés
d'idempotence, réessaie ce qui peut l'être et vérifie les webhooks. Aucune dépendance.

```bash
pip install tano-sdk
```

## Ouvrir un dossier et envoyer la personne sur le parcours

```python
import os
from tano_sdk import Tano

tano = Tano(os.environ["TANO_API_KEY"])  # tano_sandbox_… ou tano_prod_…

dossier = tano.cases.create(
    flow_name="onboarding_particulier_ci",
    country="CI",
    external_ref="client-42",  # votre référence : un seul dossier par intention
    declared={"surname": "KOUASSI", "given_names": "Awa"},
)
session = tano.sessions.create(
    case_id=dossier["id"],
    locale="fr",
    return_url="https://votre-site.example/verification/retour",  # HTTPS, sans ? ni #
)
# session["url"] : le lien du parcours, rendu une seule fois.
```

## Lire un dossier

```python
d = tano.cases.retrieve(dossier["id"])
if d.get("decision") and d["decision"]["outcome"] == "approved":
    ...

for c in tano.cases.list_all(status="review"):
    print(c["id"])
```

## Recevoir les webhooks (Flask)

```python
from tano_sdk import WebhookSignatureError, verify_webhook


@app.post("/tano")
def tano_webhook():
    try:
        evenement = verify_webhook(
            request.get_data(), request.headers, os.environ["TANO_WEBHOOK_SECRET"]
        )
    except WebhookSignatureError:
        abort(401)
    # Écartez les doublons avec evenement["delivery_id"], mettez en file, puis répondez vite.
    return "", 204
```

## Bac à sable

Avec une clé `tano_sandbox_…`, le nom de famille déclaré choisit le résultat (`TESTPASS`,
`TESTREVIEW`, `TESTFAIL`, `TESTSANCTION`, `TESTSLOW`, `TESTDOWN`), et
`tano.sandbox.submit(case_id)` fait comme si la personne avait terminé son parcours.

## Erreurs

- `TanoApiError` : l'API a répondu une erreur. Testez `error.code`, qui est stable.
- `TanoConnectionError` : pas de réponse après les réessais. Rejouer avec le même
  `idempotency_key` est sans risque.
