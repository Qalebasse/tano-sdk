# @tano/node

Le SDK serveur de Tano pour Node.js (20 et plus). Il signe les requêtes, pose les clés
d'idempotence, réessaie ce qui peut l'être et vérifie les webhooks. Aucune dépendance.

```bash
npm install @tano/node
```

## Ouvrir un dossier et envoyer la personne sur le parcours

```ts
import { Tano } from "@tano/node";

const tano = new Tano({ apiKey: process.env.TANO_API_KEY! }); // tano_sandbox_… ou tano_prod_…

const dossier = await tano.cases.create({
  flow_name: "onboarding_particulier_ci",
  country: "CI",
  external_ref: "client-42", // votre référence : un seul dossier par intention
  declared: { surname: "KOUASSI", given_names: "Awa" },
});

const session = await tano.sessions.create({
  case_id: dossier.id,
  locale: "fr",
  return_url: "https://votre-site.example/verification/retour", // HTTPS, sans ? ni #
});
// session.url : le lien du parcours, rendu une seule fois. Donnez-le au navigateur.
```

## Lire un dossier

```ts
const d = await tano.cases.retrieve(dossier.id);
if (d.decision?.outcome === "approved") { /* … */ }

for await (const c of tano.cases.listAll({ status: "review" })) console.log(c.id);
```

## Recevoir les webhooks

```ts
import express from "express";
import { verifyWebhook, WebhookSignatureError } from "@tano/node";

app.post("/tano", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const evenement = verifyWebhook(req.body, req.headers, process.env.TANO_WEBHOOK_SECRET!);
    // Écartez les doublons avec evenement.delivery_id, mettez en file, puis répondez vite.
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return res.sendStatus(401);
    throw error;
  }
});
```

## Bac à sable

Avec une clé `tano_sandbox_…`, le nom de famille déclaré choisit le résultat (`TESTPASS`,
`TESTREVIEW`, `TESTFAIL`, `TESTSANCTION`, `TESTSLOW`, `TESTDOWN`), et
`tano.sandbox.submit(caseId)` fait comme si la personne avait terminé son parcours.

## Erreurs

- `TanoApiError` : l'API a répondu une erreur. Testez `error.code`, qui est stable
  (`invalid_return_url`, `case_not_found`…). `error.requestId` aide le support.
- `TanoConnectionError` : pas de réponse après les réessais. Rejouer avec la même
  `idempotencyKey` est sans risque.
