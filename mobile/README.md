# Lever – Expo-App

Nativer Client (iOS, später Android) für Lever. Backend, Admin und Sync laufen weiter über die
Next/Payload-Instanz im Repo-Root; Fachlogik, Zustand und Texte kommen aus `../src/core`.
Stand der Portierung und offene Punkte: [MIGRATION.md](MIGRATION.md).

## Entwickeln

```bash
npm install                 # eigene Abhängigkeiten (kein Workspace)
npm run ios                 # Development-Build bauen und im Simulator starten
npx expo start              # nur Metro (Build schon installiert)
npm run typecheck
```

- `APP_VARIANT=development` → eigene App „Lever Dev“ (`de.offected.lever.dev`), läuft neben der Store-App.
- Server: `EXPO_PUBLIC_API_URL` (Standard: Live-Instanz). Lokal z. B. `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- CocoaPods braucht eine UTF-8-Locale (`LANG=en_US.UTF-8`).
- Expo SDK 58 (Beta, React Native 0.88-rc) – nötig für den Scene-Lebenszyklus des iOS-27-SDK; `.npmrc` setzt `legacy-peer-deps` wegen der RC-Version.

## Veröffentlichen

```bash
npm run release:ios         # prebuild → Archiv → Upload zu TestFlight (Xcode-Konto, Team 3498DS659A)
```

EAS-Projekt: `@offected/lever` (für Cloud-Builds/Updates bei Bedarf, `eas.json`).
