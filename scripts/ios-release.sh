#!/usr/bin/env bash
# Neue iOS-Version zu TestFlight: Oberfläche bauen → archivieren → hochladen.
#
#   npm run native:release
#
# Signiert und lädt über das in Xcode angemeldete Konto (Xcode → Einstellungen → Accounts).
# Optional per API-Schlüssel (ASC_USE_KEY=1, Werte in .env.ios, Rolle „Admin“):
#   ASC_KEY_ID=…  ASC_ISSUER_ID=…  ASC_KEY_PATH=/Users/…/AuthKey_….p8
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.ios ] && set -a && . ./.env.ios && set +a

# Build-Nummer: Zeitstempel – steigt immer, ohne dass eine Datei geändert werden muss
BUILD=$(date +%Y%m%d%H%M)
# Standard: das in Xcode angemeldete Konto (darf Profile erneuern). Mit ASC_USE_KEY=1 stattdessen
# der API-Schlüssel aus .env.ios – der braucht dafür die Rolle „Admin“.
AUTH=(-allowProvisioningUpdates)
if [ "${ASC_USE_KEY:-}" = 1 ]; then
  AUTH+=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi
OUT=ios/App/build/release

npm run native:build
rm -rf "$OUT"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/Lever.xcarchive" CURRENT_PROJECT_VERSION="$BUILD" "${AUTH[@]}" archive | tail -n 3
xcodebuild -exportArchive -archivePath "$OUT/Lever.xcarchive" -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$OUT/export" "${AUTH[@]}" | tail -n 3
echo "Build $BUILD hochgeladen – in App Store Connect erscheint er nach der Verarbeitung (meist 5–15 Minuten) unter TestFlight."
