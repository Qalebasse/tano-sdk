# Tano for Android

The [Tano](https://docs.tano.africa) identity verification journey in your Android app, with its
progress events.

## Requirements

Android 7.0 (API 24) or later · Kotlin 2.0 or later · AndroidX.

## Installation

Include the `tano` module in your build until the Maven artifact is published:

```kotlin
// settings.gradle.kts
include(":tano")
project(":tano").projectDir = file("path/to/tano-sdk/android/tano")

// app/build.gradle.kts
dependencies { implementation(project(":tano")) }
```

The module declares `INTERNET` and `CAMERA`, and asks for the camera when the journey needs it.

## Usage

Create the session on your server (`POST /v1/sessions`) and pass its `url` to the app:

```kotlin
import africa.tano.sdk.TanoEvent
import africa.tano.sdk.TanoVerification

class OnboardingActivity : AppCompatActivity() {
    private val verification = registerForActivityResult(TanoVerification()) { outcome ->
        when (outcome) {
            is TanoEvent.Completed -> showThankYou()            // then read the case on your server
            is TanoEvent.Ended -> offerRetry(outcome.reason)    // declined, expired, cancelled…
            else -> Unit
        }
    }

    fun start(sessionUrl: String) {
        TanoVerification.onEvent = { event -> analytics.track(event) } // optional, live progress
        verification.launch(sessionUrl)
    }
}
```

## API

| Symbol | Description |
| --- | --- |
| `TanoVerification` | `ActivityResultContract<String, TanoEvent>`: launches the journey, returns `Completed` or `Ended(reason)` |
| `TanoVerification.onEvent` | Every event while the journey runs, on the main thread |
| `TanoEvent` | `Ready`, `Step(step)`, `Completed`, `Ended(reason)` |

`Ended.reason`: `declined`, `expired`, `invalid_link`, `later`, or `cancelled` (back or close
before the end).

## Security

- The camera is granted to the journey's origin only; navigation stays on that origin and external
  links open in the browser.
- The journey's *upload a photo* mode uses the system file picker.
- The web view's cache and storage are cleared when the screen closes.
- Events never carry a result or personal data — read the decision on your server.

## Development

```bash
./gradlew :tano:testDebugUnitTest :demo:assembleDebug
```

`demo/` opens the URL passed as the `url` extra and logs every event (`TANO_EVENT`).

## License

MIT © Qalebasse
