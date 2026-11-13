# @tano-africa/node

[![npm](https://img.shields.io/npm/v/@tano-africa/node.svg)](https://www.npmjs.com/package/@tano-africa/node)
[![licence](https://img.shields.io/npm/l/@tano-africa/node.svg)](LICENSE)

La bibliothèque Node.js officielle de l'API [Tano](https://docs.tano.africa) : vérification
d'identité, signature électronique et cachet électronique.

- Signature des requêtes (HMAC-SHA256, v2) et protection contre le rejeu, prises en charge
- Clé d'idempotence sur chaque écriture, conservée d'un réessai à l'autre
- Réessais automatiques sur coupure réseau, `429` et `5xx`, en respectant `Retry-After`
- Vérification de la signature des webhooks
- Entièrement typée, sans dépendance, ESM

## Prérequis

Node.js 20 ou plus récent.

## Installation

```bash
npm install @tano-africa/node
```

## Démarrage rapide

```ts
import { Tano } from "@tano-africa/node";

const tano = new Tano({ apiKey: process.env.TANO_API_KEY! }); // tano_sandbox_… ou tano_prod_…

// 1. Ouvrir un dossier.
const kase = await tano.cases.create({
  flow_name: "onboarding_individual_ci",
  country: "CI",
  external_ref: "customer-42", // votre référence : un seul dossier par intention, même rejouée
  declared: { surname: "KOUASSI", given_names: "Awa" },
});

// 2. Créer une session de parcours et donner son URL à votre page ou à votre application.
const session = await tano.sessions.create({
  case_id: kase.id,
  locale: "fr",
  return_url: "https://votre-site.example/verification/terminee",
});
console.log(session.url); // rendue une seule fois, ne la stockez pas

// 3. Plus tard, lire l'issue.
const results = await tano.cases.results(kase.id);
if (results.state === "approved") {
  // …
}
```

## Configuration

```ts
new Tano({
  apiKey: string,          // obligatoire ; l'environnement se lit dans le préfixe de la clé
  baseUrl?: string,        // https://api.tano.africa par défaut
  timeoutMs?: number,      // par tentative, 30 000 par défaut
  maxRetries?: number,     // 2 par défaut
  fetch?: typeof fetch,    // une implémentation de fetch à vous
});
```

`tano.environment` vaut `"prod"`, `"sandbox"` ou `"test"`, selon la clé.

## Référence de l'API

### Dossiers

| Méthode | Route | Notes |
| --- | --- | --- |
| `cases.create(params, options?)` | `POST /v1/cases` | Signée. `flow_name`, `country`, `external_ref?`, `declared?` |
| `cases.retrieve(id)` | `GET /v1/cases/{id}` | État, étapes et décision |
| `cases.list(params?)` | `GET /v1/cases` | `q`, `external_ref`, `status`, `country`, `created_after`, `created_before`, `limit`, `cursor` |
| `cases.listAll(params?)` | toutes les pages | Itérateur asynchrone sur toutes les pages |
| `cases.results(id)` | `GET /v1/cases/{id}/results` | `state`, décision, reprise, contrôles, pièces, sans donnée personnelle |
| `cases.data(id)` | `GET /v1/cases/{id}/data` | Données personnelles. Permission `personal_data` ; chaque lecture est journalisée |
| `cases.image(id, pieceId)` | `GET /v1/cases/{id}/images/{pieceId}` | `{ contentType, data: Buffer }`. Permission `personal_data` |
| `cases.decide(id, params)` | `POST /v1/cases/{id}/decision` | `approve`, `reject` ou `resubmit` un dossier en revue. Permission `decisions` |
| `cases.erase(id)` | `POST /v1/cases/{id}/erasure` | Effacer les données personnelles d'un dossier clos. Permission `personal_data` |

`results.state` vaut `awaiting_applicant`, `processing`, `in_review`, `resubmission_requested`
(pas un refus : la personne doit reprendre des photos), `approved`, `rejected` (définitif),
`expired` ou `abandoned`.

### Sessions

| Méthode | Route | Notes |
| --- | --- | --- |
| `sessions.create(params, options?)` | `POST /v1/sessions` | `case_id`, `locale?`, `lifetime_minutes?` (1 à 60), `return_url?` (HTTPS, sans paramètre ni fragment) |

### Bac à sable

| Méthode | Route | Notes |
| --- | --- | --- |
| `sandbox.submit(caseId)` | `POST /v1/sandbox/cases/{id}/submit` | Clés de bac à sable seulement. Le nom de famille déclaré choisit l'issue : `TESTPASS`, `TESTREVIEW`, `TESTFAIL`, `TESTSANCTION`, `TESTSLOW`, `TESTDOWN` |

### Signature électronique

| Méthode | Route | Notes |
| --- | --- | --- |
| `signatureRequests.create(params, options?)` | `POST /v1/signature-requests` | Signée. Les PDF en `Buffer` sont encodés en base 64 ; `activate: true` envoie dans le même appel |
| `signatureRequests.retrieve(id)` | `GET /v1/signature-requests/{id}` | État, documents, signataires |
| `signatureRequests.list(params?)` | `GET /v1/signature-requests` | `status`, `reference`, `limit` |
| `signatureRequests.activate(id)` | `POST …/{id}/activate` | Envoyer un brouillon |
| `signatureRequests.cancel(id, reason)` | `POST …/{id}/cancel` | Annuler une demande en cours |
| `signatureRequests.delete(id)` | `DELETE …/{id}` | Supprimer un brouillon |
| `signatureRequests.link(id, signerId)` | `POST …/{id}/signers/{signerId}/link` | `{ url }` : le lien d'un signataire invité ; il remplace le précédent |
| `signatureRequests.download(id, documentId)` | `GET …/{id}/documents/{documentId}/download` | `PdfFile` : `data`, `sha256`, `signed`, `sandbox` |
| `signatureRequests.auditTrail(id)` | `GET …/{id}/audit-trail` | `PdfFile` : le fichier de preuve, une fois la demande complétée |
| `sandbox.sign(id, signerId)` / `sandbox.decline(id, signerId)` | `POST /v1/sandbox/signature-requests/…` | Clés de bac à sable seulement : simuler la réponse d'un signataire invité |

```ts
import { readFile, writeFile } from "node:fs/promises";

const demande = await tano.signatureRequests.create({
  name: "Bail — appartement Cocody",
  reference: "BAIL-2026-118",
  documents: [{ filename: "bail.pdf", content: await readFile("bail.pdf") }],
  signers: [
    {
      given_name: "Aya",
      family_name: "Koné",
      email: "aya.kone@exemple.ci",
      auth_method: "otp_email",
      // En points PDF, depuis le coin bas gauche de la page.
      fields: [{ document: 0, kind: "signature", page: 1, x: 60, y: 80, width: 170, height: 50 }],
    },
  ],
  activate: true,
});

// Plus tard, à la réception de `signature_request.completed` :
const signe = await tano.signatureRequests.download(demande.id, demande.documents[0].id);
await writeFile("bail-signe.pdf", signe.data);
```

Le guide : [Faire signer un document](https://docs.tano.africa/signature-electronique/faire-signer/).

### Cachet électronique

| Méthode | Route | Notes |
| --- | --- | --- |
| `seals.profiles()` | `GET /v1/seal-profiles` | Les profils utilisables : les vôtres, puis celui de Tano |
| `seals.create({ profile_id, document, reference? })` | `POST /v1/seals` | Signée, synchrone. `document` en `Buffer` ou en base 64 |
| `seals.retrieve(id)` | `GET /v1/seals/{id}` | |
| `seals.download(id)` | `GET /v1/seals/{id}/download` | `PdfFile` |
| `documents.verify(document)` | `POST /v1/verify` | Les signatures et cachets d'un PDF, et leur intégrité. Toute clé |

### Requêtes brutes

`tano.request(method, path, body?, options?)` appelle une route que la bibliothèque n'expose pas
encore, avec la même signature, la même idempotence et les mêmes réessais.

### Options de requête

Chaque méthode accepte `{ idempotencyKey?: string, signal?: AbortSignal }`. Réutilisez la même
`idempotencyKey` pour rejouer sans risque la même intention.

## Webhooks

Passez le corps **brut** : un objet re-sérialisé ne correspond plus à la signature.

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
  // Écartez les doublons avec event.delivery_id, mettez le traitement en file, répondez vite.
  res.sendStatus(204);
});
```

`verifyWebhook(body, headers, secret, { toleranceSeconds?: number = 300 })` rend
`{ type, occurred_at, object, data, delivery_id }`. Pour un événement de dossier, `object` porte
aussi `external_ref`, `flow_name` et `environment`.

## Erreurs

| Classe | Quand | Champs utiles |
| --- | --- | --- |
| `TanoApiError` | L'API a répondu une erreur | `status`, `type`, `code` (stable, à tester), `field`, `requestId`, `docUrl` |
| `TanoConnectionError` | Pas de réponse après les réessais | Rejouer avec la même `idempotencyKey` est sans risque |
| `WebhookSignatureError` | Une livraison n'a pas passé la vérification | Répondez `401` |
| `TanoError` | Classe de base, par exemple une clé mal formée | |

Chaque code d'erreur est documenté sur `https://docs.tano.africa/errors/<code>`.

## Support

- Documentation : https://docs.tano.africa
- Support : support@tano.africa
- Sécurité : security@tano.africa

## Licence

[MIT](LICENSE) © Qalebasse
