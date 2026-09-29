# SDK Tano

Les bibliothèques officielles de [Tano](https://docs.tano.africa) — la vérification d'identité
(KYC) pensée pour l'Afrique.

| Paquet | Plateforme | Installation |
| --- | --- | --- |
| [`@tano-africa/node`](node) | Serveur Node.js | `npm install @tano-africa/node` |
| [`tano-sdk`](python) | Serveur Python | `pip install tano-sdk` |
| [`@tano-africa/web`](web) | Navigateur | `npm install @tano-africa/web` |
| [`@tano-africa/react`](react) | React | `npm install @tano-africa/react` |
| [`@tano-africa/react-native`](react-native) | React Native | `npm install @tano-africa/react-native react-native-webview` |
| [`TanoSDK`](ios) | iOS (Swift) | Swift Package Manager |
| [`tano-android`](android) | Android (Kotlin) | Module Gradle |
| [`tano_flutter`](flutter) | Flutter | Paquet pub |

## Comment s'articule une intégration

```
 Votre serveur ──(clé d'API, signé)──▶ API Tano ──(webhooks, signés)──▶ Votre serveur
      │  POST /v1/cases                                 case.decided
      │  POST /v1/sessions → url
      ▼
 Votre page web / votre application ──(url)──▶ Parcours de vérification Tano (hébergé, intégré ou dans l'app)
```

1. **Serveur** — ouvrez un dossier et une session avec un SDK serveur. La clé d'API ne quitte
   jamais votre serveur.
2. **Client** — ouvrez le parcours avec l'`url` de la session : dans votre page
   (`@tano-africa/web`, `@tano-africa/react`), dans une fenêtre, ou dans votre application
   mobile (iOS, Android, Flutter, React Native).
3. **Décision** — lisez-la sur votre serveur : webhook `case.decided`, ou `cases.results(id)`.

Les SDK clients ne rapportent que l'avancement du parcours (`ready`, `step`, `completed`,
`ended`). Ils ne transportent jamais de résultat ni de donnée personnelle : tout ce qui passe par
un navigateur ou une application peut être falsifié, pas une signature côté serveur.

## Sécurité

- Les requêtes à l'API sont signées (HMAC-SHA256, v2) et protégées contre le rejeu ; les
  webhooks sont signés et horodatés. Les SDK serveur s'en chargent.
- Lire des données personnelles, télécharger des images ou trancher un dossier exige des
  permissions de clé explicites (`personal_data`, `decisions`), accordées dans la console.
  Chaque lecture est journalisée.
- Le parcours intégré ne s'affiche que dans les pages dont vous avez autorisé l'origine,
  vérifiée par le navigateur.

Signalez une vulnérabilité à **security@tano.africa**, sans ouvrir de ticket public.

## Développement

```bash
pnpm install && pnpm lint && pnpm types && pnpm test && pnpm build      # paquets JavaScript
cd python && uv sync && uv run ruff check . && uv run mypy && uv run pytest
cd ios && swift test
cd android && ./gradlew :tano:testDebugUnitTest :demo:assembleDebug
cd flutter && flutter analyze && flutter test
```

Les signatures sont testées contre des vecteurs calculés par l'API Tano elle-même.

## Licence

[MIT](LICENSE) © Qalebasse
