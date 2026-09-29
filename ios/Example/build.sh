#!/bin/sh
# Construire l'application de démonstration pour le simulateur, sans projet Xcode.
set -eu
cd "$(dirname "$0")"
output="${1:-build}"
rm -rf "$output/TanoDemo.app" && mkdir -p "$output/TanoDemo.app" "$output/module"
target="arm64-apple-ios15.0-simulator"
# Le SDK, compilé comme module, puis l'application qui l'importe.
xcrun -sdk iphonesimulator swiftc -target "$target" -parse-as-library -emit-library -static \
  -module-name TanoSDKDemoSupport -emit-module -emit-module-path "$output/module/TanoSDKDemoSupport.swiftmodule" \
  ../Sources/TanoSDK/*.swift -o "$output/module/libTanoSDKDemoSupport.a"
xcrun -sdk iphonesimulator swiftc -target "$target" -parse-as-library -I "$output/module" \
  -L "$output/module" -lTanoSDKDemoSupport DemoApp.swift -o "$output/TanoDemo.app/TanoDemo"
cp Info.plist "$output/TanoDemo.app/Info.plist"
echo "$output/TanoDemo.app"
