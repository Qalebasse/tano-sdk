# @tano-africa/react

[![npm](https://img.shields.io/npm/v/@tano-africa/react.svg)](https://www.npmjs.com/package/@tano-africa/react)
[![licence](https://img.shields.io/npm/l/@tano-africa/react.svg)](LICENSE)

Le parcours de vérification d'identité [Tano](https://docs.tano.africa) en composant React,
construit sur [`@tano-africa/web`](https://www.npmjs.com/package/@tano-africa/web).

## Installation

```bash
npm install @tano-africa/react
```

React 18 ou plus récent.

## Utilisation

Autorisez votre origine dans la console Tano (*Développeurs* → *Parcours dans vos pages*), créez
la session sur votre serveur, puis :

```tsx
import { TanoVerification } from "@tano-africa/react";

export function Verification({ url }: { url: string }) {
  return (
    <TanoVerification
      url={url}
      onCompleted={() => router.push("/verification/thanks")}
      onEnded={(reason) => setEnded(reason)}
      onExpired={() => fetch("/api/verification/link").then((r) => r.json()).then((j) => j.url)}
    />
  );
}
```

## Propriétés

| Propriété | Type | Description |
| --- | --- | --- |
| `url` | `string` | L'URL de la session. La changer remonte le parcours |
| `onReady` | `() => void` | Le parcours est affiché |
| `onStep` | `(step) => void` | Une étape commence |
| `onCompleted` | `() => void` | Tout a été envoyé — lisez le dossier côté serveur |
| `onEnded` | `(reason) => void` | `declined`, `expired`, `invalid_link`, `later` |
| `onEvent` | `(event) => void` | Tous les événements, tels quels |
| `onExpired` | `() => Promise<string>` | Rendez une nouvelle URL de session pour reprendre sur place |
| `minHeight` | `number` | Hauteur minimale du cadre, en pixels |
| `title` | `string` | Titre accessible du cadre |
| `className`, `style` | | Appliqués au conteneur |

Les rappels sont toujours lus à jour : les changer ne recharge pas le parcours.

## Licence

[MIT](LICENSE) © Qalebasse
