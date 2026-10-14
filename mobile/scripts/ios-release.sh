#!/usr/bin/env bash
# Expo-App zu TestFlight: native Projekte erzeugen → archivieren → hochladen.
#
#   npm run release:ios
#
# Signiert und lädt über das in Xcode angemeldete Konto (wie das bisherige scripts/ios-release.sh
# der Capacitor-App). Build-Nummer = Zeitstempel, damit sie immer steigt.
set -euo pipefail
cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods braucht UTF-8

BUILD=$(date +%Y%m%d%H%M)
export BUILD_NUMBER=$BUILD   # app.config.ts → CFBundleVersion der App
OUT=build/release
rm -rf "$OUT"

CI=1 npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/Lever.xcworkspace -scheme Lever -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/Lever.xcarchive" CURRENT_PROJECT_VERSION="$BUILD" -allowProvisioningUpdates archive | tail -n 3
xcodebuild -exportArchive -archivePath "$OUT/Lever.xcarchive" -exportOptionsPlist scripts/ExportOptions.plist \
  -exportPath "$OUT/export" -allowProvisioningUpdates | tail -n 3
echo "Build $BUILD hochgeladen – erscheint nach der Verarbeitung (meist 5–15 Minuten) unter TestFlight."
