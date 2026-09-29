# TanoSDK (iOS)

Le parcours de vérification Tano dans votre application iOS (15 et plus), avec ses événements.

## Installation

Swift Package Manager : ajoutez ce dépôt, produit `TanoSDK`. Dans l'Info.plist de l'application :
`NSCameraUsageDescription` (« La caméra sert à photographier votre pièce d'identité et votre
visage. »).

## Utilisation

Votre serveur crée la session (`POST /v1/sessions`) et rend son `url` à l'application :

```swift
import TanoSDK

let verification = TanoVerificationViewController(url: sessionURL) { event in
    switch event {
    case .step(let etape): print("étape", etape)        // consent, document, face, uploading…
    case .completed: self.afficherMerci()                  // puis lisez le dossier côté serveur
    case .ended(let raison): self.proposerDeReprendre(raison) // declined, expired, cancelled…
    case .ready: break
    }
}
present(UINavigationController(rootViewController: verification), animated: true)
```

- La caméra n'est accordée qu'à l'origine du parcours ; un lien vers une autre adresse s'ouvre
  dans Safari. Rien n'est gardé : la WebView n'a pas de stockage persistant.
- Aucun événement ne porte de résultat : la décision se lit côté serveur (webhook `case.decided`).

## Démonstration

`Example/construire.sh` construit une application pour le simulateur, sans projet Xcode ; elle
ouvre le lien passé en argument et journalise les événements (`TANO_EVENT`).
