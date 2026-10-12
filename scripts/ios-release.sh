#!/usr/bin/env bash
# Neue iOS-Version zu TestFlight: Oberfläche bauen → archivieren → hochladen.
#
#   npm run native:release
#
# Braucht einen App Store Connect API-Key (App Store Connect → Benutzer und Zugriff →
# Integrationen → App Store Connect API → Schlüssel, Rolle „App-Manager“). Die drei Werte
# stehen in .env.ios (liegt nicht im Repo), die .p8-Datei irgendwo außerhalb des Repos:
#   ASC_KEY_ID=…  ASC_ISSUER_ID=…  ASC_KEY_PATH=/Users/…/AuthKey_….p8
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.ios ] && set -a && . ./.env.ios && set +a
: "${ASC_KEY_ID:?ASC_KEY_ID fehlt (.env.ios)}" "${ASC_ISSUER_ID:?ASC_ISSUER_ID fehlt}" "${ASC_KEY_PATH:?ASC_KEY_PATH fehlt}"

# Build-Nummer: Zeitstempel – steigt immer, ohne dass eine Datei geändert werden muss
BUILD=$(date +%Y%m%d%H%M)
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
OUT=ios/App/build/release

npm run native:build
rm -rf "$OUT"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/Lever.xcarchive" CURRENT_PROJECT_VERSION="$BUILD" "${AUTH[@]}" archive | tail -n 3
xcodebuild -exportArchive -archivePath "$OUT/Lever.xcarchive" -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath "$OUT/export" "${AUTH[@]}" | tail -n 3
echo "Build $BUILD hochgeladen – in App Store Connect erscheint er nach der Verarbeitung (meist 5–15 Minuten) unter TestFlight."
