#!/bin/sh
# Construire l'application de démonstration pour le simulateur, sans projet Xcode.
set -eu
cd "$(dirname "$0")"
sortie="${1:-build}"
rm -rf "$sortie/TanoDemo.app" && mkdir -p "$sortie/TanoDemo.app" "$sortie/module"
cible="arm64-apple-ios15.0-simulator"
# Le SDK, compilé comme module, puis l'application qui l'importe.
xcrun -sdk iphonesimulator swiftc -target "$cible" -parse-as-library -emit-library -static \
  -module-name TanoSDKDemoSupport -emit-module -emit-module-path "$sortie/module/TanoSDKDemoSupport.swiftmodule" \
  ../Sources/TanoSDK/*.swift -o "$sortie/module/libTanoSDKDemoSupport.a"
xcrun -sdk iphonesimulator swiftc -target "$cible" -parse-as-library -I "$sortie/module" \
  -L "$sortie/module" -lTanoSDKDemoSupport DemoApp.swift -o "$sortie/TanoDemo.app/TanoDemo"
cp Info.plist "$sortie/TanoDemo.app/Info.plist"
echo "$sortie/TanoDemo.app"
