# @tano-africa/web

[![npm](https://img.shields.io/npm/v/@tano-africa/web.svg)](https://www.npmjs.com/package/@tano-africa/web)
[![licence](https://img.shields.io/npm/l/@tano-africa/web.svg)](LICENSE)

La bibliothèque navigateur officielle de [Tano](https://docs.tano.africa) : le parcours de
vérification d'identité **dans votre page**, dans une fenêtre ou dans l'onglet — et son
avancement.

- Parcours intégré (`mount`), avec une poignée de main vérifiée par origine : il ne s'affiche jamais sur un site que vous n'avez pas autorisé
- Fenêtre ou redirection (`launch`), avec une page de retour qui prévient l'onglet d'origine
- Événements d'avancement, hauteur automatique, renouvellement d'un lien expiré sur place
- Moins de 3 Ko minifié, sans dépendance, ESM et version `<script>`

## Installation

```bash
npm install @tano-africa/web
```

Ou sans outil de construction :

```html
<script src="https://cdn.jsdelivr.net/npm/@tano-africa/web/dist/tano-web.global.js"></script>
<!-- window.TanoWeb.mount(…), window.TanoWeb.launch(…), window.TanoWeb.handleReturn() -->
```

## Le parcours dans votre page (recommandé)

1. **Autorisez vos origines** dans la console Tano → *Développeurs* → *Parcours dans vos pages*
   (`https://www.votre-site.com` ; ajoutez `http://localhost:5173` pour développer).
2. **Créez la session sur votre serveur** (`POST /v1/sessions`) et rendez son `url` à la page.
3. **Montez le parcours** :

```ts
import { mount } from "@tano-africa/web";

const journey = mount("#verification", {
  url: session.url,
  onStep: (step) => trackStep(step),        // consent, document, face, uploading…
  onCompleted: () => showThankYou(),        // puis lisez le dossier côté serveur
  onEnded: (reason) => offerRetry(reason),  // declined, expired, invalid_link, later
  // Le lien a expiré : rendez-en un nouveau, le parcours reprend dans le même cadre.
  onExpired: () => fetch("/api/verification/link").then((r) => r.json()).then((j) => j.url),
});

// journey.destroy() le retire.
```

La caméra n'est déléguée qu'au cadre du parcours (`allow="camera"`), sans référent. Le parcours
fait une poignée de main avec votre page avant de s'afficher : le navigateur atteste l'origine de
votre page, qui doit figurer dans votre liste — encadré ailleurs, il affiche un refus et n'envoie
rien.

### `mount(target, options)`

| Option | Type | Description |
| --- | --- | --- |
| `url` | `string` | L'URL de la session, rendue par `POST /v1/sessions`. Obligatoire |
| `onReady` | `() => void` | Le parcours est affiché |
| `onStep` | `(step: EmbedStep) => void` | Une étape commence |
| `onCompleted` | `() => void` | Tout a été envoyé |
| `onEnded` | `(reason: EndReason) => void` | Arrêt sans envoi |
| `onEvent` | `(event: JourneyEvent) => void` | Tous les événements, tels quels |
| `onExpired` | `() => Promise<string>` | Rendez une nouvelle URL de session pour reprendre sur place |
| `autoHeight` | `boolean` | Suivre la hauteur du parcours (`true` par défaut) |
| `minHeight` | `number` | Hauteur du cadre en pixels (`640` par défaut) |
| `title` | `string` | Titre accessible du cadre |

Rend `{ iframe: HTMLIFrameElement, destroy(): void }`.

## Fenêtre ou redirection

```ts
import { launch } from "@tano-africa/web";

button.addEventListener("click", () => {
  launch({ url: session.url, onReturn: () => refreshStatus() });
});
```

`launch` ouvre une fenêtre (depuis un geste de la personne), ou l'onglet si la fenêtre est bloquée
(`fallbackToRedirect: false` pour l'interdire ; `mode: "redirect"` pour toujours utiliser
l'onglet). Créez la session avec une `return_url` sur votre site ; sur cette page :

```ts
import { handleReturn } from "@tano-africa/web";

const context = await handleReturn(); // "popup" : la fenêtre se ferme · "page" : continuez ici
```

## Événements

| Événement | Contenu |
| --- | --- |
| `tano:ready` | `version` |
| `tano:step` | `step` : `consent`, `applicant`, `questionnaire`, `document`, `face`, `check`, `uploading`, `help` |
| `tano:completed` | — |
| `tano:ended` | `reason` : `declined`, `expired`, `invalid_link`, `later` |
| `tano:resize` | `height` |

Aucun événement ne porte de résultat ni de donnée personnelle. **Lisez la décision sur votre
serveur** — webhook `case.decided`, ou `GET /v1/cases/{id}/results`.

## Erreurs

`TanoWebError`, avec `code` : `invalid_url` (pas en HTTPS, sauf `localhost`), `popup_blocked`,
`unsupported`.

## Navigateurs

Versions actuelles de Chrome, Edge, Firefox et Safari (iOS 15.4 et plus) — `BroadcastChannel` et
`MessageEvent.origin`.

## Licence

[MIT](LICENSE) © Qalebasse
