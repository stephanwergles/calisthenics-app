# Calisthenics

Progressionsbasierte Trainings-App für drei feste Workouts pro Woche.

| | |
|---|---|
| **v1** (im Einsatz) | `index.html` – eine Datei, läuft auf GitHub Pages, Daten im Browser |
| **v2** (im Aufbau) | Next.js 16 + Payload 3 + Postgres, Deployment über Ploi. Trainingsansicht unter `/`, offline-fähig; Admin unter `/admin` |

v1 bleibt im Hauptverzeichnis, bis v2 im Training trägt – GitHub Pages liefert
sie von dort aus. Danach wird sie gelöscht; die Git-Historie bewahrt sie.

## v2 lokal starten

Voraussetzungen: Node ≥ 22.18, Docker.

```bash
cp .env.example .env        # PAYLOAD_SECRET setzen: openssl rand -hex 32
npm install
npm run db:up               # Postgres 17 auf Port 5433
npm run payload -- migrate  # Schema anlegen
npm run seed                # Katalog einspielen (wiederholbar)
npm run dev                 # http://localhost:3000/admin – erste Person anlegen
npm run import:v1 -- <v1-export.json> <email>   # Trainingshistorie übernehmen
```

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/client/` | Trainingsansicht: `logic.ts` (reine Trainingslogik, getestet), `db.ts` (IndexedDB), `useTraining.ts` (Zustand), `components/` |
| `public/sw.js` | Service Worker – Trainingsansicht startet ohne Netz |
| `src/domain/model.ts` | Datenmodell. Leitregel: Jede Referenz über eine **stabile ID**, nie über eine Position |
| `src/seed/catalog.json` | Katalog: 47 Übungen, 24 Progressionen, 3 Workouts, Wochenplan |
| `src/collections/`, `src/globals/` | Payload-Collections; Katalog-IDs sind die Slugs aus dem Katalog |
| `src/migrations/` | Datenbank-Migrationen – auch lokal, kein automatisches Schema-Push |
| `src/migrate/` | Import für v1-Exporte (`core.ts` ohne Dateizugriff – läuft in Node und im Browser) |
| `scripts/` | Katalog aus v1 erzeugen, Katalog einspielen, v1-Export importieren |
| `test/` | `npm test` – v1-Smoke-Test und Import-Tests (nur erfundene Daten, das Repo ist öffentlich) |

## Trainingsansicht

Unter `/`. Daten liegen lokal im Browser (IndexedDB) – **noch ohne Sync**. Unter
„Daten“ lässt sich ein v1-Export übernehmen (wiederholbar) und alles als JSON
sichern. Der Katalog kommt bis zum Sync aus `src/seed/catalog.json`, also aus dem Build.

Offline-Start über `public/sw.js`, nur im Produktionsbuild aktiv (`npm run build && npm start`).
Bei Änderungen am Service Worker `CACHE` hochzählen; bei jedem Deploy `APP_VERSION`
in `src/client/version.ts` erhöhen.

## Schema ändern

```bash
# Collections anpassen, dann:
npm run payload -- migrate:create <name>
npm run payload -- migrate
npm run generate:types
```

Migrationsdateien committen – der Server führt beim Deploy genau diese aus.

## Deployment (Ploi, Server blank-apps)

Einmalig in Ploi:

1. **Datenbank** anlegen (Postgres) und `DATABASE_URL` notieren.
2. **Site** für die Domain anlegen, Repo `stephanwergles/calisthenics-app`, Branch `main`.
   Node-Projekt auf Port 3000 (Nginx als Reverse Proxy).
3. **Node ≥ 22.18** auf dem Server sicherstellen.
4. **Environment** der Site: `DATABASE_URL`, `PAYLOAD_SECRET` (eigener, neuer Wert),
   `NEXT_PUBLIC_SERVER_URL=https://<domain>`.
5. **Daemon**: `npm run start` im Site-Verzeichnis, als Name `calisthenics`.

Deploy-Skript:

```bash
cd {SITE_DIRECTORY}
git pull origin {BRANCH}
npm ci
npm run payload -- migrate
npm run build
npm run seed
sudo -S supervisorctl restart calisthenics:*   # bzw. Neustart des Daemons in Ploi
```

`npm run seed` ist wiederholbar und hält den Katalog auf dem Stand von
`src/seed/catalog.json`. Nach dem ersten Deploy unter `/admin` die eigene Person
anlegen und die Historie importieren (lokal gegen die Server-Datenbank oder per
SSH auf dem Server).
