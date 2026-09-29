# @tano-africa/react-native

[![npm](https://img.shields.io/npm/v/@tano-africa/react-native.svg)](https://www.npmjs.com/package/@tano-africa/react-native)
[![licence](https://img.shields.io/npm/l/@tano-africa/react-native.svg)](LICENSE)

Le parcours de vérification d'identité [Tano](https://docs.tano.africa) dans une application React
Native, construit sur `react-native-webview`.

## Installation

```bash
npm install @tano-africa/react-native react-native-webview
```

Puis :

- **iOS** — ajoutez `NSCameraUsageDescription` à l'`Info.plist`, puis `pod install`.
- **Android** — déclarez `android.permission.CAMERA` et demandez-la avant d'ouvrir le parcours
  (par exemple avec `react-native-permissions`).

React Native 0.73 ou plus récent, `react-native-webview` 13 ou plus récent.

## Utilisation

```tsx
import { TanoVerification } from "@tano-africa/react-native";

<TanoVerification
  url={session.url} // créée par votre serveur (POST /v1/sessions)
  onEvent={(event) => {
    if (event.type === "completed") navigation.replace("Thanks"); // puis lisez le dossier côté serveur
    if (event.type === "ended") showRetry(event.reason);          // declined, expired, cancelled…
  }}
/>
```

## Événements

| `type` | Contenu |
| --- | --- |
| `ready` | — |
| `step` | `step` : `consent`, `applicant`, `questionnaire`, `document`, `face`, `check`, `uploading`, `help` |
| `completed` | — |
| `ended` | `reason` : `declined`, `expired`, `invalid_link`, `later`, ou `cancelled` quand l'écran se ferme avant la fin |

## Sécurité

- La caméra n'est accordée qu'à l'origine du parcours ; la navigation reste sur cette origine et
  les liens sortants s'ouvrent dans le navigateur du système.
- La WebView fonctionne en navigation privée : rien du parcours n'est gardé sur l'appareil.
- Aucun événement ne porte de résultat ni de donnée personnelle — lisez la décision sur votre
  serveur.

## Licence

[MIT](LICENSE) © Qalebasse
