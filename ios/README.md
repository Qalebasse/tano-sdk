# TanoSDK pour iOS

Le parcours de vérification d'identité [Tano](https://docs.tano.africa) dans votre application
iOS, avec ses événements d'avancement.

## Prérequis

iOS 15 ou plus récent · Swift 5.9 ou plus récent · Xcode 15 ou plus récent.

## Installation

Swift Package Manager : dans Xcode, *File → Add Package Dependencies*, adresse
`https://github.com/Qalebasse/tano-sdk`, produit `TanoSDK`. Ou dans un `Package.swift` :

```swift
.package(url: "https://github.com/Qalebasse/tano-sdk", from: "0.1.0")
```

Ajoutez à l'`Info.plist` de l'application :

```xml
<key>NSCameraUsageDescription</key>
<string>La caméra sert à photographier votre pièce d'identité et votre visage.</string>
```

## Utilisation

Créez la session sur votre serveur (`POST /v1/sessions`) et transmettez son `url` à
l'application :

```swift
import TanoSDK

let verification = TanoVerificationViewController(url: sessionURL) { event in
    switch event {
    case .ready:
        break
    case .step(let step):
        analytics.track(step)            // consent, document, face, uploading…
    case .completed:
        self.showThankYou()              // puis lisez le dossier côté serveur
    case .ended(let reason):
        self.offerRetry(reason)          // declined, expired, invalid_link, later, cancelled
    }
}
present(UINavigationController(rootViewController: verification), animated: true)
```

## API

| Symbole | Description |
| --- | --- |
| `TanoVerificationViewController(url:onEvent:)` | Le parcours plein écran dans une `WKWebView`, avec un bouton de fermeture (`ended("cancelled")`) |
| `TanoEvent` | `.ready`, `.step(String)`, `.completed`, `.ended(String)` |
| `TanoJourneyURL.validated(_:)` | URL en `https`, ou `http://localhost` pour développer |

## Sécurité

- La caméra n'est accordée qu'à l'origine du parcours ; la navigation reste sur cette origine et
  les liens sortants s'ouvrent dans Safari.
- La WebView n'a pas de stockage persistant : rien du parcours n'est gardé sur l'appareil.
- Aucun événement ne porte de résultat ni de donnée personnelle — lisez la décision sur votre
  serveur.

## Exemple

`Example/build.sh` construit une application de démonstration pour le simulateur iOS, sans projet
Xcode. Elle ouvre l'URL passée en argument de lancement et journalise chaque événement
(`TANO_EVENT`).

## Licence

MIT © Qalebasse
