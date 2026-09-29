// swift-tools-version:5.9
// Le SDK iOS de Tano : le parcours de vérification dans une WKWebView, et ses événements.
//
// Manifeste à la racine du dépôt, comme l'exige Swift Package Manager ; le code vit dans `ios/`.
// Les versions du paquet Swift sont les étiquettes semver nues du dépôt (`0.1.0`).

import PackageDescription

let package = Package(
    name: "TanoSDK",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [.library(name: "TanoSDK", targets: ["TanoSDK"])],
    targets: [
        .target(name: "TanoSDK", path: "ios/Sources/TanoSDK"),
        .testTarget(name: "TanoSDKTests", dependencies: ["TanoSDK"], path: "ios/Tests/TanoSDKTests"),
    ]
)
