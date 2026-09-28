# Tano Android

Le parcours de vérification Tano dans votre application Android (API 24 et plus), avec ses
événements.

## Utilisation

Votre serveur crée la session (`POST /v1/sessions`) et rend son `url` à l'application :

```kotlin
import africa.tano.sdk.TanoEvent
import africa.tano.sdk.TanoVerification

private val verification = registerForActivityResult(TanoVerification()) { issue ->
    when (issue) {
        is TanoEvent.Completed -> afficherMerci()             // puis lisez le dossier côté serveur
        is TanoEvent.Ended -> proposerDeReprendre(issue.reason) // declined, expired, cancelled…
        else -> Unit
    }
}

// Les étapes en direct, si besoin :
TanoVerification.onEvent = { event -> suivi(event) }
verification.launch(sessionUrl)
```

- Le SDK déclare `CAMERA` et `INTERNET`, et demande la caméra au moment où le parcours en a
  besoin. Elle n'est accordée qu'à l'origine du parcours ; un lien vers une autre adresse
  s'ouvre dans le navigateur.
- Le mode « envoyer une photo » du parcours ouvre le sélecteur du téléphone.
- À la fermeture, cache et stockage de la WebView sont vidés.
- Aucun événement ne porte de résultat : la décision se lit côté serveur (webhook `case.decided`).

## Développer

```bash
./gradlew :tano:testDebugUnitTest :demo:assembleDebug
```

`demo/` ouvre le lien passé en extra (`url`), sinon l'aperçu local de tano-web
(`adb reverse tcp:5188 tcp:5188`), et journalise les événements (`TANO_EVENT`).
