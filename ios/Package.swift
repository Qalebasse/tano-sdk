// swift-tools-version:5.9
// Le SDK iOS de Tano : le parcours de vérification dans une WKWebView, et ses événements.

import PackageDescription

let package = Package(
    name: "TanoSDK",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [.library(name: "TanoSDK", targets: ["TanoSDK"])],
    targets: [
        .target(name: "TanoSDK"),
        .testTarget(name: "TanoSDKTests", dependencies: ["TanoSDK"]),
    ]
)
