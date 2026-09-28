# tano_flutter

Le parcours de vérification Tano dans une application Flutter (Android et iOS), avec ses
événements.

```dart
import 'package:tano_flutter/tano_flutter.dart';

TanoVerification(
  url: Uri.parse(session.url), // créée par votre serveur (POST /v1/sessions)
  onEvent: (event) => switch (event) {
    TanoCompleted() => afficherMerci(),          // puis lisez le dossier côté serveur
    TanoEnded(:final reason) => reprendre(reason), // declined, expired, cancelled…
    TanoStep(:final step) => suivi(step),
    TanoReady() => null,
  },
)
```

- iOS : `NSCameraUsageDescription` dans l'Info.plist. Android : permission `CAMERA`, à demander
  avant d'ouvrir le parcours (par exemple avec `permission_handler`).
- La page reste dans l'origine du parcours ; un lien sortant s'ouvre dans le navigateur.
- Aucun événement ne porte de résultat : la décision se lit côté serveur (webhook `case.decided`).

`example/` : démonstration, éprouvée sur émulateur Android.
