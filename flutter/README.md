# tano_flutter

Le parcours de vérification d'identité [Tano](https://docs.tano.africa) dans votre application
Flutter (Android et iOS), avec ses événements d'avancement.

## Prérequis

Flutter 3.24 ou plus récent · Dart 3.5 ou plus récent · Android API 24+ · iOS 15+.

## Installation

```bash
flutter pub add tano_flutter
```

- **iOS** — ajoutez `NSCameraUsageDescription` à l'`Info.plist`.
- **Android** — déclarez `android.permission.CAMERA` et demandez-la avant d'ouvrir le parcours
  (par exemple avec `permission_handler`).

## Utilisation

```dart
import 'package:tano_flutter/tano_flutter.dart';

TanoVerification(
  url: Uri.parse(session.url), // créée par votre serveur (POST /v1/sessions)
  onEvent: (event) => switch (event) {
    TanoReady() => null,
    TanoStep(:final step) => analytics.track(step),
    TanoCompleted() => showThankYou(),              // puis lisez le dossier côté serveur
    TanoEnded(:final reason) => offerRetry(reason), // declined, expired, cancelled…
  },
)
```

## API

| Symbole | Description |
| --- | --- |
| `TanoVerification({required Uri url, required onEvent})` | Le parcours, dans un `WebViewWidget` |
| `TanoEvent` | `TanoReady`, `TanoStep(step)`, `TanoCompleted`, `TanoEnded(reason)` |

`TanoEnded.reason` : `declined`, `expired`, `invalid_link`, `later`, ou `cancelled` quand le widget
est retiré avant la fin.

## Sécurité

- La caméra est accordée à la demande ; la navigation reste sur l'origine du parcours et les liens
  sortants s'ouvrent dans le navigateur du système.
- Le cache et le stockage local sont vidés quand le widget est retiré.
- Aucun événement ne porte de résultat ni de donnée personnelle — lisez la décision sur votre
  serveur.

## Exemple

`example/` ouvre le parcours et journalise ses événements.

## Licence

MIT © Qalebasse
