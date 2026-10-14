# Sicherheit

## Lücken melden

Bitte nicht als öffentliches Issue, sondern über [GitHub Security Advisories](https://github.com/stephanwergles/calisthenics-app/security/advisories/new) („Report a vulnerability“).

## Was der Server tut

- **Anmeldung:** Payload sperrt ein Konto nach 5 Fehlversuchen für 10 Minuten. Zusätzlich bremst `src/collections/Users.ts` je IP (Login 20 / 15 min, „Passwort vergessen“ 5 / h). Konten legen nur Admins an.
- **Sitzungen:** Token 60 Tage gültig, serverseitig gespeichert (`useSessions`) – Abmelden widerruft das Token sofort, Konto löschen alle.
- **Rechte:** Katalog nur Admins schreibbar, Nutzerdaten nur für die eigene Person (`src/access.ts`). Local-API-Aufrufe mit Nutzereingaben immer `overrideAccess: false`. `npm run check:access` prüft das gegen eine echte Datenbank – in der CI bei jedem Push.
- **Sync** (`/api/sync`): 30 Anfragen pro Minute und Person, höchstens 8 MB und 2000 Dokumente je Liste, jedes Dokument wird vor dem Schreiben geprüft (`src/sync/convert.ts`).
- **Konto löschen** (`/api/account/delete`): Einheiten, Aktivitäten, Pläne, Feedback und Person.
- **Angriffsfläche:** GraphQL abgeschaltet, CORS nur für die eigene Seite, Sicherheits-Header (HSTS, nosniff, Frame-Schutz) in `next.config.ts`.
- **Repo öffentlich:** keine Zugangsdaten, keine Trainingsexporte (`.gitignore`); gitleaks prüft die ganze Historie in der CI.

## Bekannte, bewusst akzeptierte Meldungen (`npm audit`, Stand 14.10.2026)

Alle betreffen Build-Werkzeuge, nicht den ausgelieferten Code, und haben noch keinen Fix:

| Paket | Wo | Warum unkritisch |
|---|---|---|
| braces / chokidar / sass | Payload-Admin-Build | nur beim Bauen, keine Eingaben von außen |
| esbuild ≤ 0.24 | drizzle-kit (Migrationen) | betrifft nur den Entwicklungsserver von esbuild |
| metro, micromatch, braces | Expo/React-Native-Bundler | läuft nur auf dem Entwicklungsrechner |
| node-forge | Expo-CLI (Code-Signing für OTA-Updates) | OTA-Updates sind nicht im Einsatz |

Die CI schlägt bei „critical“ an; Dependabot meldet Updates wöchentlich.
