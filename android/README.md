# Tano pour Android

Le parcours de vérification d'identité [Tano](https://docs.tano.africa) dans votre application
Android, avec ses événements d'avancement.

## Prérequis

Android 7.0 (API 24) ou plus récent · Kotlin 2.0 ou plus récent · AndroidX.

## Installation

Incluez le module `tano` dans votre build, en attendant la publication de l'artefact Maven :

```kotlin
// settings.gradle.kts
include(":tano")
project(":tano").projectDir = file("chemin/vers/tano-sdk/android/tano")

// app/build.gradle.kts
dependencies { implementation(project(":tano")) }
```

Le module déclare `INTERNET` et `CAMERA`, et demande la caméra au moment où le parcours en a besoin.

## Utilisation

Créez la session sur votre serveur (`POST /v1/sessions`) et transmettez son `url` à
l'application :

```kotlin
import africa.tano.sdk.TanoEvent
import africa.tano.sdk.TanoVerification

class OnboardingActivity : AppCompatActivity() {
    private val verification = registerForActivityResult(TanoVerification()) { outcome ->
        when (outcome) {
            is TanoEvent.Completed -> showThankYou()            // puis lisez le dossier côté serveur
            is TanoEvent.Ended -> offerRetry(outcome.reason)    // declined, expired, cancelled…
            else -> Unit
        }
    }

    fun start(sessionUrl: String) {
        TanoVerification.onEvent = { event -> analytics.track(event) } // facultatif, en direct
        verification.launch(sessionUrl)
    }
}
```

## API

| Symbole | Description |
| --- | --- |
| `TanoVerification` | `ActivityResultContract<String, TanoEvent>` : lance le parcours, rend `Completed` ou `Ended(reason)` |
| `TanoVerification.onEvent` | Chaque événement pendant le parcours, sur le fil principal |
| `TanoEvent` | `Ready`, `Step(step)`, `Completed`, `Ended(reason)` |

`Ended.reason` : `declined`, `expired`, `invalid_link`, `later`, ou `cancelled` (retour ou
fermeture avant la fin).

## Sécurité

- La caméra n'est accordée qu'à l'origine du parcours ; la navigation reste sur cette origine et
  les liens sortants s'ouvrent dans le navigateur.
- Le mode « envoyer une photo » du parcours utilise le sélecteur de fichiers du système.
- Le cache et le stockage de la WebView sont vidés à la fermeture de l'écran.
- Aucun événement ne porte de résultat ni de donnée personnelle — lisez la décision sur votre
  serveur.

## Développement

```bash
./gradlew :tano:testDebugUnitTest :demo:assembleDebug
```

`demo/` ouvre l'URL passée en extra `url` et journalise chaque événement (`TANO_EVENT`).

## Licence

MIT © Qalebasse
