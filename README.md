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
| `src/client/` | Trainingsansicht: `logic.ts` (reine Trainingslogik, getestet), `db.ts` (IndexedDB), `useTraining.ts` (Zustand + Sync-Ablauf), `sync.ts` (Server-Aufrufe, Konfliktregel), `components/` |
| `src/sync/` | Sync-Endpunkt `POST /api/sync` (`endpoint.ts`) und die reinen Umrechnungen App ↔ Payload (`convert.ts`, getestet) |
| `public/sw.js` | Service Worker – Trainingsansicht startet ohne Netz |
| `src/domain/model.ts` | Datenmodell. Leitregel: Jede Referenz über eine **stabile ID**, nie über eine Position |
| `src/seed/catalog.json` | Katalog: 47 Übungen, 24 Progressionen, 3 Workouts, Wochenplan |
| `src/collections/`, `src/globals/` | Payload-Collections; Katalog-IDs sind die Slugs aus dem Katalog |
| `src/migrations/` | Datenbank-Migrationen – auch lokal, kein automatisches Schema-Push |
| `src/migrate/` | Import für v1-Exporte (`core.ts` ohne Dateizugriff – läuft in Node und im Browser) |
| `scripts/` | Katalog aus v1 erzeugen, Katalog einspielen, v1-Export importieren |
| `test/` | `npm test` – v1-Smoke-Test, Import-, Logik- und Sync-Tests (nur erfundene Daten, das Repo ist öffentlich) |

## Trainingsansicht

Unter `/`. Vor dem Training die Startseite **Heute** (Woche, Serie, Workout des Tages,
nächste Skills), nach „Training beenden“ ein **Abschluss** mit Bestwerten. Training im **Fokus-Modus**: eine Übung pro Screen mit Kreide-Skizze, drei
Kernpunkten, Muskeln und großem Zähler; nach dem Speichern ein Pausen-Screen mit Ring.
Kernpunkte und Muskeln stehen in `src/seed/coaching.json`. Vier Bereiche über die Tab-Leiste unten (darüber die Session-Leiste mit
Timer, solange trainiert wird): **Training** (Fokus auf die aktive Übung; Notizen
pro Satz im Satz-Editor und zur ganzen Einheit, die Satz-Notizen vom letzten Mal
stehen an der Übung), **Verlauf**, **Skills** (Skill-Tree)
(Kalender mit Tagesansicht und Cardio-Erfassung für beliebige Tage; Fortschritt pro
Übung über alle Stufen mit Summe, Delta zur vorigen Einheit derselben Stufe und
Balkendiagramm) und **Daten**. Die App liest und schreibt **nur lokal** (IndexedDB) und gleicht im
Hintergrund mit Payload ab – im Gym lädt keine Ansicht Daten vom Server. Unter
„Daten“ anmelden (Payload-Nutzer, Sitzung 60 Tage, wird bei jedem Start verlängert),
einen v1-Export übernehmen (wiederholbar) oder alles als JSON sichern.

**Sync** (`POST /api/sync`, ein Aufruf hin und zurück):

- Jede Änderung landet im Postausgang (IndexedDB `kv.outbox`) und wird ~2,5 s später
  gesendet; außerdem beim Start, bei Netz-Rückkehr, beim Zurückholen der App und per Button.
- Der erste Abgleich nach der Anmeldung lädt alles vom Gerät hoch, danach nur Geändertes.
  Vom Server kommt alles, was seit dem letzten Abgleich (`serverTime`) geändert wurde.
- Konflikte: Die jüngere Änderung gewinnt (`updatedAt` aus der App, in Payload als
  `clientUpdatedAt`). Lokal noch nicht gesendete Änderungen überschreibt der Server nie mit
  einer älteren Fassung.
- Einheiten sind über `datum-workout` eindeutig, Aktivitäten über ihre ID; Trainingsstand
  (aktuelle Stufen, Pausierte) liegt am Nutzer.
- Der Katalog kommt vom Server, sobald er sich geändert hat (`catalogVersion` = jüngste
  Änderung an Übungen, Progressionen, Workouts, Wochenplan) – Änderungen im Admin landen
  so ohne Deploy in der App. Ohne Server-Katalog gilt `src/seed/catalog.json` aus dem Build.

Offline-Start über `public/sw.js`, nur im Produktionsbuild aktiv (`npm run build && npm start`).
Bei Änderungen am Service Worker `CACHE` hochzählen; bei jedem Deploy `APP_VERSION`
in `src/client/version.ts` erhöhen.

## iOS-App (Capacitor)

Native Hülle um dieselbe Oberfläche, Projekt in `ios/`. Die Oberfläche liegt **im App-Paket**
(startet immer offline), nur der Sync geht an die Live-Instanz – dort per Token statt Cookie,
weil die App von `capacitor://localhost` kommt (in `payload.config.ts` unter `cors` erlaubt).
Zusätzlich zur Web-App: Benachrichtigung am Pausenende (auch bei gesperrtem Display), Haptik,
Display bleibt während der Session an. Native Teile stecken in `src/client/native.ts`
und sind im Browser wirkungslos.

```bash
npm run native:build   # next build → native/www → cap sync ios
npm run native:open    # Xcode öffnen
```

**TestFlight** (Updates ohne Kabel): App einmalig in App Store Connect anlegen, API-Key
in `.env.ios` eintragen (Vorlage im Kopf von `scripts/ios-release.sh`), dann pro Update:

```bash
npm run native:release   # native:build → Archiv (Build-Nummer = Zeitstempel) → Upload
```

In Xcode einmalig unter *Signing & Capabilities* das eigene Team wählen
(Bundle-ID `de.offected.lever`), dann aufs iPhone spielen (▶) oder über
*Product → Archive* zu TestFlight hochladen. Nach jeder Änderung an der Oberfläche
`npm run native:build` und neu bauen – die App zieht keine Updates vom Server.

## Schema ändern

```bash
# Collections anpassen, dann:
npm run payload -- migrate:create <name>
npm run payload -- migrate
npm run generate:types
```

Migrationsdateien committen – der Server führt beim Deploy genau diese aus.

## Deployment (Ploi, Server blank-apps)

Live unter **https://calisthenics.apps.blank-studio.de** (Admin unter `/admin`).
So ist die Site eingerichtet – beim Neuaufsetzen genauso:

1. **Datenbank** `calisthenics` (Postgres) auf blank-apps.
2. **Site** `calisthenics.apps.blank-studio.de`, Repo `stephanwergles/calisthenics-app`,
   Branch `main`, Projekttyp **NodeJS**, Web directory **`/public`** – nicht das
   Hauptverzeichnis: Dort liegen `.env` und die v1-`index.html`. Server-Node: 24.x.
3. **Environment** (Ploi legt `.env` aus `.env.example` an – Werte anpassen):
   ```
   DATABASE_URL=postgres://<db-user>:<db-passwort>@127.0.0.1:5432/calisthenics
   PAYLOAD_SECRET=<openssl rand -hex 32>
   NEXT_PUBLIC_SERVER_URL=https://calisthenics.apps.blank-studio.de
   ```
   Port **5432** (nicht 5433 aus der lokalen Vorlage). Kein `NODE_ENV=production`
   setzen – sonst fehlen beim Build die Dev-Abhängigkeiten (TypeScript).
4. **Deploy-Skript** – ohne Composer:
   ```
   cd {SITE_DIRECTORY}
   git pull origin main
   npm ci
   npm run payload -- migrate
   npm run build
   npm run seed
   pm2 reload calisthenicsappsblank-studiode --update-env || pm2 start npm --name calisthenicsappsblank-studiode -- run start -- -p 3101
   pm2 save
   ```
   Die pm2-Zeile startet die App auch dann, wenn pm2 sie nicht (mehr) kennt – Ploi
   setzt sonst nur `pm2 reload`, und das scheitert mit „Process … not found“.
5. **pm2** (über den NodeJS-Projekttyp): Start-Befehl `npm run start -- -p 3101`.
   Der Port muss im Befehl stehen, sonst nimmt Next 3000. **Einmalig** per SSH
   `pm2 startup` ausführen und die ausgegebene `sudo`-Zeile übernehmen, danach
   `pm2 save` – sonst startet die App nach einem Server-Neustart nicht wieder
   (Symptom: 502, im Deploy-Log „Spawning PM2 daemon“ und „Process … not found“).
6. **Nginx**: Der NodeJS-Projekttyp richtet den Proxy **nicht** selbst ein. Den
   `location /`-Block ersetzen (PHP-Block entfernen):
   ```nginx
   location / {
       proxy_pass http://127.0.0.1:3101;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
   }
   ```
   Symptom, wenn das fehlt: `/` liefert ein Nginx-403, nur `/sw.js` und das Icon kommen an.
7. **Nach dem ersten Deploy sofort** unter `/admin` das eigene Konto anlegen – solange
   keins existiert, darf das jede:r.

`npm run seed` ist wiederholbar und hält den Katalog auf dem Stand von
`src/seed/catalog.json`.
