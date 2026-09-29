# TanoSDK for iOS

The [Tano](https://docs.tano.africa) identity verification journey in your iOS app, with its
progress events.

## Requirements

iOS 15 or later · Swift 5.9 or later · Xcode 15 or later.

## Installation

Swift Package Manager, product `TanoSDK`. Until the public Swift package repository is available,
add this `ios/` directory as a local package (*File → Add Package Dependencies → Add Local*).

Add to your app's `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>The camera is used to photograph your identity document and your face.</string>
```

## Usage

Create the session on your server (`POST /v1/sessions`) and pass its `url` to the app:

```swift
import TanoSDK

let verification = TanoVerificationViewController(url: sessionURL) { event in
    switch event {
    case .ready:
        break
    case .step(let step):
        analytics.track(step)            // consent, document, face, uploading…
    case .completed:
        self.showThankYou()              // then read the case on your server
    case .ended(let reason):
        self.offerRetry(reason)          // declined, expired, invalid_link, later, cancelled
    }
}
present(UINavigationController(rootViewController: verification), animated: true)
```

## API

| Symbol | Description |
| --- | --- |
| `TanoVerificationViewController(url:onEvent:)` | Full-screen journey in a `WKWebView`, with a close button (`ended("cancelled")`) |
| `TanoEvent` | `.ready`, `.step(String)`, `.completed`, `.ended(String)` |
| `TanoJourneyURL.validated(_:)` | `https` URLs, or `http://localhost` for development |

## Security

- The camera is granted to the journey's origin only; navigation stays on that origin and external
  links open in Safari.
- The web view uses a non-persistent data store: nothing from the journey is kept on the device.
- Events never carry a result or personal data — read the decision on your server.

## Example

`Example/build.sh` builds a demo app for the iOS simulator, without an Xcode project. It opens the
URL passed as launch argument and logs every event (`TANO_EVENT`).

## License

MIT © Qalebasse
