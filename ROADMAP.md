# ROADMAP

> **Richtung seit Okt 2026:** Lever geht in den App Store — Deutsch und Englisch, das Training entsteht aus den Skills. Technischer Plan: [v3](#v3--app-store-training-aus-skills). Produktstrategie liegt bewusst nicht im (öffentlichen) Repo.

## Status quo (v1.4 — Juli 2026)

Single-File-App, feature-complete für die Selbst-Validierung:
3er-Split (24 Slots, 47 Progressionsstufen) · Satz-Logging mit Wdh./Sekunden/Zusatzgewicht · verdiente Freischaltungen (2× alle Sätze am Ziel) · Technik-Sektionen (Position, Ausführung, Fehler, Leichter/Schwerer, Kreide-Skizzen) · Pausen-Timer mit Auto-Start · Trainings-Session-Timer · Log mit Dauer · JSON-Export/Import.

Seit v1.4: Sätze pro Tag anpassbar (± direkt an der Übung) · erledigte Übungen klappen automatisch zu, die aktive ist hervorgehoben · Hold-Timer für Zeitübungen im Satz-Editor · Pausen-Timer zeitstempelbasiert (übersteht App-Suspend) · Zoom gesperrt · Lösch-Button mit Rückfrage (v1.4.1) · Versionsnummer im Header + In-App-Update-Check mit Neustart-Banner gegen iOS-PWA-Caching (v1.4.2) · Wake Lock: Display bleibt während laufender Session an (v1.5.0) · App-Icon + Favicon + Home-Bildschirm-Titel „Calisthenics" (v1.5.1; seit v1.5.2 Kreide-C statt Strichfigur) · Export-Erinnerung im Log, Einheiten im Log löschbar (v1.6.0) · Lösch-Button mit lokalem Datum + nur bei Bedarf sichtbar (v1.6.3/v1.6.4) · Offected-Farbschema: Orange #FF4D00 auf Schwarz #101010 (v1.7.0/v1.7.1) · Navigation neu: 2 Tabs — Workout mit Split-Wahl inkl. Rotations-Empfehlung, Übungs-/Satz-Zähler und prominentem Start-Button, Activity mit Monatskalender (v1.8.0) · Kalender als Tages-Filter (v1.8.1) · Übungen pro Tag überspringbar, Uneven Pull-ups als Vorstufe vor Archer (v1.9.0) · Button-System mit Varianten, 44px-Touch-Targets, Fokus-Ringe, Badge/Button klar getrennt (v1.10.0) · Split-Empfehlung folgt dem festen Wochenrhythmus So=A / Mo=C / Mi=B statt stumpfer Rotation, Wochentage im Picker sichtbar und in Wochenreihenfolge (v1.11.0–v1.11.2) · Cardio-Einträge (Rad/Lauf) im Activity-Tab inkl. Kalender-Markierung, Warm-up- und Cool-down-Checklisten pro Trainingstag, Export auf version 4 (v1.12.0) · lockeres Cardio als erster Cool-down-Punkt an Tag A und B, direkt aus dem Workout eintragbar (v1.13.0) · Timer-Alarm mit Ton und blinkender Leiste statt Vibration (auf iOS nie unterstützt), Uneven Pull-ups im Tag A vorgezogen, Bizeps-Curls als Stangen-Variante beschrieben (v1.14.0) · Handstand-Balance als eigener Skill-Slot an Tag B (Wall Handstand → Heel Pulls → frei), Band-Muscle-up als Zwischenstufe (v1.15.0) · Übungen dauerhaft pausierbar für Urlaub, fehlendes Gerät oder Verletzung, Export auf version 5, Smoke-Test als `test/smoke.js` im Repo (v1.16.0) · Muscle-up-Weg nach Trainingsfeedback umgebaut: Band-Muscle-up ist die Transition-Übung, Chest-to-Bar-Klimmzüge liefern die fehlende Zughöhe (v1.16.2) · Fortschrittsansicht im Activity-Tab: pro Übung Verlauf über alle Stufen, Delta, Wertetabelle (v1.17.0).

**Aktuelle Phase: 6–8 Wochen mit v1 trainieren und Daten sammeln.** Jede Feature-Idee in dieser Zeit landet hier statt im Code — erst am Ende der Phase wird anhand der eigenen Logs entschieden, was v2 wirklich braucht.

---

## v1.x — kleine Verbesserungen (nur bei echtem Bedarf im Training)

- [ ] Deload-Erinnerung: Hinweis-Banner alle 4 Wochen bzw. wenn Werte über 2+ Einheiten stagnieren
- [x] ~~Warm-up-Checkliste pro Tag~~ — erledigt in v1.12.0, inkl. Cool-down/Dehnen
- [ ] Wochenübersicht im Log (Einheiten/Woche, Gesamtvolumen, Gesamtzeit)
- [ ] Satz-Notizen (Freitext, z.B. „Ellenbogen gezwickt") — Vorstufe der v2-Regenerationslogik
- [ ] Service-Worker für garantiertes Offline (aktuell nur Browser-Cache)
- [ ] Optional: Barlow Condensed via Google Fonts wieder aktivieren (auf Pages kein CSP-Problem; Offline-Fallback bleibt System-Stack)

**Nicht in v1.x:** alles was Sync, Accounts oder Backend braucht.

---

## v2 — die echte App (Next.js + Payload CMS)

**Startkriterium:** v1-Validierung abgeschlossen (regelmäßig trainiert, Logs zeigen welche Features fehlen) **und** mindestens ein konkreter Bedarf, den v1 nicht abdecken kann (typischerweise: Sync über Geräte, oder die adaptive Planung).

### Erkenntnisse aus 10 Wochen v1 (Review Okt 2026)

Startkriterium gilt als erfüllt: 16 Einheiten seit Juli, App wird ausschließlich genutzt. Konkrete Bedarfe, die v1 nicht abdeckt:

- **Positions-IDs sind die größte Schwäche.** LogKeys wie `0-0@1` hängen an Tag-, Slot- und Stufenposition; jede Planänderung riskiert, dass Historie still an der falschen Übung hängt (`ord` ist nur eine Umgehung). v2 braucht **stabile Übungs-IDs** (Slugs) — das ist Aufgabe Nummer eins, noch vor jeder Oberfläche.
- **Planänderungen brauchen heute Code + Push.** Übungen und Pläne gehören ins CMS (Payload).
- **Backup hängt am manuellen Export** nach iCloud.
- **Web-Plattform-Grenzen:** keine Vibration, kein Ton bei Stummschalter, kein Alarm bei gesperrtem Display, kein Apple Health. Das löst kein Web-Framework, sondern nur eine native Hülle (Capacitor) mit lokalen Benachrichtigungen und HealthKit → eigene Phase nach 2.0.
- **Erfassung passt nicht ganz zum echten Training:** AMRAP-Workouts wie Cindy haben keinen Platz, Cardio wird kaum eingetragen (zu viel Aufwand), Versuche vs. Treffer (Band-Muscle-up) sind nicht abbildbar.
- **Workout-Ansicht im Gym zu lang:** Fokus-Modus für die aktive Übung, feste Leiste unten schlanker.
- Die Trainings-App bleibt **offline-first**: Daten lokal (IndexedDB), Sync im Hintergrund — keine Seite lädt im Gym Daten vom Server.

### Phase 2.0 — Fundament

**Stand Okt 2026:**
- [x] Datenmodell mit stabilen IDs, Katalog (47 Übungen, 24 Progressionen, 3 Workouts), Import für v1-Exporte — an allen Exporten seit Juli geprüft: 405/405 Sätze, fünf Positions-Bedeutungswechsel aus der Git-Historie korrekt aufgelöst
- [x] Payload-Projekt im selben Repo: Collections, deutscher Admin, Migrationen, Seed- und Import-Skript; lokal mit echter Historie getestet, Produktions-Build grün
- [x] Deployment auf Ploi (blank-apps, Postgres) — https://calisthenics.apps.blank-studio.de, Anleitung in README.md
- [x] Offline-Client (IndexedDB) mit Trainingsansicht: Fokus auf aktive Übung, Satz-Editor, Überspringen/Pausieren/Freischalten, Pausen- und Session-Timer, Wake Lock, Warm-up/Cool-down mit Cardio, v1-Import im Browser, Service Worker — lokal mit echter Historie und ohne Server getestet
- [x] UI-Konzept „Kreide & Volt“ (Canvas), Schritt 1 umgesetzt: Fokus-Satz mit Skizze, Kernpunkten und Muskeln, Pausen-Screen mit Ring, Barlow, Lucide, Akzent Volt
- [x] UI Schritt 2: Startseite „Heute“ (Wochenleiste, Serie, Dauer-Schätzung, nächste Skills) und Abschluss-Screen mit Bestwerten und Vergleich
- [x] UI Schritt 3: Skill-Tree als eigener Tab (Leitern, Stand zur Freischaltung, Freischalten)
- [x] Native iOS-App (Capacitor): Oberfläche im App-Paket, Sync per Token, Benachrichtigung am Pausenende, Haptik, Display wach
- [ ] Apple Health: Workouts speichern → Phase 3.2
- [ ] TestFlight-Verteilung → Phase 3.2 (geschlossene Beta)
- [x] Notizen pro Satz und zur Einheit (sichtbar beim nächsten Mal und im Verlauf); UI-Update: Tab-Leiste unten, kompakte Workout-Wahl, eigenes Icon-Set
- [x] Verlauf: Kalender mit Tagesansicht und Cardio für beliebige Tage, Fortschritt pro Übung über alle Stufen
- [x] Sync zwischen Client und Payload: Postausgang, ein Endpunkt, jüngere Änderung gewinnt, Katalog kommt vom Server
- Monorepo/Projekt-Setup: Next.js (App Router) + Payload 3 + Postgres, Deployment auf eigener Infra (Ploi/Hetzner — bestehender Agentur-Stack)
- Payload-Collections aus dem v1-Datenmodell ableiten (die Struktur ist 1:1 übertragbar):
  - `exercises` (heutige Levels: Name, Technik-Texte, Skizze/Medien, Ziel, Einheit, Gewichts-Flag)
  - `progressions` (heutige Slots: geordnete Liste von exercises + Unlock-Kriterium)
  - `plans` (Tage → Slots, Blöcke, Pausenzeiten)
  - `sessions` / `setLogs` (heutiges Log-Format; Import-Script für die v1-JSON-Exports)
  - `users` (Payload-Auth)
- v1-Feature-Parität als PWA (installierbar, offline-first mit Sync-Queue)
- **Meilenstein: eigener Umstieg von v1 auf v2 mit importierter Historie**

---

## v3 — App Store: Training aus Skills

Produktstrategie, Positionierung, Wettbewerb und Bezahlmodell stehen bewusst **nicht** in diesem öffentlichen Repo. Hier nur der technische Plan.

### Leitidee

**Das Workout ist die Summe der Skill-Leitern.** Wer die App nutzt, wählt Ziel-Skills, gibt Equipment und Trainingstage an und macht einen Kurztest. Daraus setzt Lever die Einheiten zusammen: Jede Übung ist die aktuelle Stufe einer Leiter, eine Freischaltung ändert das Workout automatisch. Alles bleibt anpassbar. Regeln (Zug/Druck/Beine im Gleichgewicht, Erholung für Sehnen) warnen, sie sperren nicht.

| Ebene | Gehört | Inhalt |
|---|---|---|
| **Katalog** | global, nur Admin pflegt | Übungen, Progressionen, Skills — zweisprachig |
| **Nutzerplan** | Nutzer, synchronisiert | vom Generator erzeugt, danach frei anpassbar (Überschreibungen pro Slot) |

Historie hängt weiter **pro Übungs-ID**, nie am Plan — deshalb darf ein Plan neu erzeugt oder umgebaut werden, ohne Daten zu verlieren. Der bisherige feste Plan (3er-Split A/B/C) wird mein Nutzerplan und zugleich der **Abnahmetest des Generators**: Mit meinen Zielen und Wochentagen muss etwas Vergleichbares herauskommen.

### Datenmodell (Zielbild)

**Ablauf aus Nutzersicht:** Einstufung („was kann ich schon“) → Vorschlag der realistischsten nächsten Skills, Auswahl 1–3 → Trainingstage und Split-Vorlage (vorgeschlagen, frei wählbar) → erzeugter Plan → Fortschritt verschiebt Stufen automatisch; Planänderungen (Skill erreicht, Ziele/Tage geändert) nur **nach Bestätigung** als neue Planversion → Phasen für Pause, Urlaub, Equipment, Verletzung → jederzeit eigene Workouts und Anpassungen einzelner Einheiten.

| Entität | Gehört | Inhalt |
|---|---|---|
| **Übung** (`exercises`) | Katalog | Technik, Einheit, Clip + **Metadaten**: `equipment` (Alternativen), `pattern`, `difficulty`, `stress` je Sehne. Texte de/en |
| **Leiter** (`progressions`) | Katalog | Stufen mit Ziel (`target` = Standardwert, im Plan überschreibbar) + **Einstufungs-Regel** (Testwert → Startstufe) |
| **Skill** (`skills`, neu) | Katalog | Ziel-Leiter(n), immer mitlaufende Support-Leitern, Voraussetzungen (Leiter + Mindeststufe) → Skill-Tree als Graph, „realistisch als Nächstes“ |
| **Split-Vorlage** (`splits`, neu) | Katalog | Tage + Thema je Tag (z. B. Pull/Push/Lower, Ganzkörper ×3, Upper/Lower ×2, PPL ×2); der Generator füllt Themen-Tage |
| **Profil** | Person | Ziel-Skills, Trainingstage, Einheitendauer, Equipment, Einstufungs-Ergebnisse, Sprache, Einwilligungen, Rolle |
| **Stand** | Person | Stufe je Leiter, pausierte Leitern (gibt es) |
| **Plan** (`plans`, neu) | Person | **versioniert**; Vorlage, Workouts mit stabilen Keys, Slots `{ block, progression \| exercise, pinned?, overrides? { sets, min, max, restSec, unlockAt }, reason }`, Warm-up/Cool-down; Herkunft je Workout: erzeugt oder **eigen** |
| **Phase** (`phases`, neu) | Person | Zeitraum oder „bis auf Weiteres“: Pause/Krank (nichts fällig, Serie bleibt, danach reduziertes Volumen), Urlaub, Equipment temporär (Generator tauscht Stufen/Leitern), Verletzung (Körperstelle/Sehne → betroffene Übungen ersetzen) |
| **Einheit** (`sessions`) | Person | Protokoll je Übung (gibt es); plus **Tagesanpassung**: hinzugefügte/entfernte Übungen nur für diese Einheit |

- **Slots zeigen auf Leitern** (Stufe folgt dem Stand, Freischaltung ändert das Workout ohne Planänderung). Eigene Workouts dürfen auch auf eine **feste Übung** zeigen (ohne Progression).
- **Eigene Workouts:** Name, Übungen/Leitern mit Sätzen, Wdh.-Bereich, Pause; frei im Plan einsetzbar. Aus einer angepassten Einheit „als neues Workout speichern“.
- **Bestätigungspflicht:** Der Generator erzeugt nur Vorschläge (Diff „vorher → nachher“ mit Begründung); erst die Bestätigung schreibt eine neue Planversion. Ausnahme ohne Rückfrage: die Stufe innerhalb einer Leiter.
- Historie hängt weiter **pro Übungs-ID**, nie am Plan – Planversionen, eigene Workouts und Tagesanpassungen verlieren keine Daten.
- `workouts` (global) und `weekplan` entfallen nach der Migration; die drei bisherigen Workouts werden mein Plan und eine Test-Fixture.
- **Sessions:** `workout` zeigt heute per Relationship auf den globalen Katalog – Umstellung auf **Plan-Workout-Key + Namens-Snapshot**.
- **KI** (Sprachmodell) nur als Übersetzer und Berater, der Plan bleibt regelbasiert: Freitext → Phase („Schulter links zwickt bei Dips“ → Verletzung Schulter, Dips ersetzen), Begründungen für Skill-Vorschläge, Wochenrückblick aus Notizen. Immer als Vorschlag mit Bestätigung.
- Jedes neue Nutzerfeld durch `src/sync/convert.ts` + Roundtrip-Test (siehe CLAUDE.md).
- **Prototyp:** `src/domain/generator.ts` mit `src/seed/exercise-meta.json` und `skills.json` (ohne UI/Payload, `node scripts/generate-plan.ts`) – erkennt Tagesthemen heute selbst; nächster Schritt: Split-Vorlagen als Eingabe.

### Phase 3.0 — Mehrbenutzer-Fundament

Ziel: Fremde Menschen können die App sicher nutzen. Keine neuen Trainings-Features.

- [x] **Katalog-Rechte:** Lesen für Angemeldete, Schreiben nur Rolle `admin` (`isAdmin` in `src/access.ts`; Sync-Endpunkt läuft mit den Rechten der Person, `npm run check:access` prüft gegen die DB)
- [x] Rollen an `users` (`admin` / `athlete`), Admin-Panel nur für `admin` (Rolle nur durch Admins änderbar; Migration macht das älteste Konto zum Admin)
- [ ] `plans` einführen, `workouts` → mein Plan migrieren, Sessions auf Plan-Workout-Keys umstellen (Migration + Sync + Tests)
- [x] **App ohne Account nutzbar** (lokal, offline); Account nur für Sync/Backup und Käufe (seit v2: IndexedDB, Anmeldung optional unter „Daten“)
- [ ] Anmeldung: **Sign in with Apple** + E-Mail
- [x] **Account-Löschung in der App** (Apple 5.1.1(v)) inkl. Server-Daten (`POST /api/account/delete`, „Daten“ → „Konto löschen“, geprüft in `check:access`); Datenexport als JSON (gab es schon)
- [ ] Einwilligung Gesundheitsdaten (Art. 9 DSGVO), Datenschutzerklärung de/en, Gesundheits-Disclaimer
- [ ] **i18n-Gerüst:** UI-Strings in Wörterbücher (de/en), Payload-Localization für Katalogfelder, Datums-/Zahlenformat per Locale
- [x] Server: Rate-Limit am Sync-Endpunkt (30/min je Person, `src/sync/rateLimit.ts`); Login-Sperre nach 5 Fehlversuchen (Payload-Standard)
- [ ] Server: tägliche DB-Backups (Ploi → Datenbank → Backups einrichten), Fehler-Monitoring

### Phase 3.1 — Katalog als Generator-Grundlage

- [ ] `skills`-Collection + Voraussetzungs-Graph; Skill-Tree-Tab zeigt den Graph (Prototyp-Daten: `src/seed/skills.json`)
- [ ] Metadaten (`equipment`, `pattern`, `difficulty`, `stress`) für alle bestehenden 47 Übungen (Prototyp-Daten: `src/seed/exercise-meta.json`, unsichere Werte markiert)
- [ ] `splits`: Split-Vorlagen (2–6 Tage) mit Thema je Tag (Prototyp: `src/seed/splits.json`, Generator verteilt Themen auf Wochentage)
- [ ] Einstufungs-Regel je Leiter (Testwert → Startstufe) (Prototyp: `src/seed/assessment.json`, `src/domain/assessment.ts` mit Skill- und Split-Vorschlägen)
- [ ] Lücken in den Grundmustern schließen, damit jeder Plan ausgeglichen werden kann (je Muster mindestens eine Leiter pro gängiger Equipment-Kombination)
- [ ] Erste neue Skill-Leitern: Front Lever · Back Lever · Planche · Handstand-Push-up (weitere in 3.4)
- [ ] Fachliche Prüfung der Leitern und Freischalt-Schwellen durch einen Coach

### Phase 3.2 — Training aus Skills (Herzstück) → geschlossene Beta

- [ ] **Kurztest:** Max-Tests (Klimmzüge, Dips, Liegestütze, Hollow Hold, L-Sit, Pistol-Tiefe) → Startstufe jeder Leiter; wiederholbar; bei vorhandener Historie aus den Logs abgeleitet
- [ ] **Eingaben:** Ziel-Skills (1–3, vorgeschlagen nach Nähe der Voraussetzungen), Equipment, Trainingstage (Wochentage), Split-Vorlage (vorgeschlagen, frei wählbar), Einheitendauer
- [ ] **Generator** als reine, deterministische Funktion (Domain-Schicht, Client und Server):
  1. Skills → Leitern: Ziel-Leiter + noch nicht erfüllte Voraussetzungs-Leitern
  2. Grundmuster auffüllen (Zug vertikal/horizontal, Druck vertikal/horizontal, Beine, Rumpf), gefiltert nach Equipment
  3. Verteilen auf Tage: Skill-Slots zuerst in der Einheit, anspruchsvollste Skills an den Tag mit der längsten Pause davor, gleiche Sehnen-Belastung nicht an Folgetagen
  4. Volumen aus den Stufen-Standards, an das Dauer-Budget angepasst
- [ ] **Leitplanken** als dieselben Regeln in `logic.ts`: Der Generator hält sie ein, bei manuellen Änderungen erscheinen sie als Hinweise
- [ ] Tests: Eigenschaften für beliebige Eingaben (Balance, keine Sehnen-Kollision an Folgetagen, Dauer-Budget, nur verfügbares Equipment) + Abnahmetest mit meinen Eingaben
- [ ] **Anpassen:** Übung tauschen (andere Stufe oder gleiches `pattern`), Slot festpinnen, Volumen überschreiben, Slot entfernen; neu erzeugen behält gepinnte Slots und Überschreibungen
- [ ] Ziel erreicht → Vorschlag für den nächsten Skill; Ziele/Tage/Vorlage ändern → **Vorschlag als Diff, erst nach Bestätigung neue Planversion**
- [ ] **Phasen:** Pause/Krank (Serie bleibt, Wiedereinstieg mit reduziertem Volumen), Urlaub, Equipment temporär, Verletzung (Sehne/Körperstelle → Übungen ersetzen) – mit Zeitraum oder bis auf Weiteres
- [ ] **Eigene Workouts:** Name, Übungen oder Leitern mit Sätzen/Wdh./Pause, im Plan einsetzbar
- [ ] **Tagesanpassung:** Übungen für eine Einheit hinzufügen/entfernen, danach „als neues Workout speichern“
- [ ] Onboarding: Sprache → Kurztest → Ziele → Equipment/Tage → erzeugter Plan mit Begründung pro Slot („wegen Muscle-up“, „Ausgleich Druck“)
- [ ] Apple Health: Workouts speichern
- [ ] **TestFlight, geschlossene Beta** mit 5–10 Fortgeschrittenen, Feedback-Kanal in der App

### Phase 3.3 — Englisch & Store-Bereitschaft

- [ ] Englische Fassung aller Oberflächentexte, Technik-Texte, Kernpunkte, Muskeln
- [ ] App-Name und Bundle-Anzeigename final (Markenprüfung muss abgeschlossen sein)
- [ ] Store-Eintrag de/en: Texte, Screenshots, Vorschauvideo, Privacy-Label, Support- und Datenschutz-URL, Altersfreigabe
- [ ] Impressum/Anbieter, AGB/EULA
- [ ] Datenschutzfreundliche Nutzungsstatistik (ohne Tracking-SDK) für Onboarding-Abbrüche
- [ ] Review-Vorbereitung: Demo-Account, Guideline 4.2 (native Funktionen: Tab-Leiste, Benachrichtigungen, HealthKit, Haptik)
- [ ] In-App-Purchase technisch (StoreKit, serverseitige Prüfung, Freischaltung im Profil) — Modell wird außerhalb des Repos entschieden

### Phase 3.4 — Ausbau nach dem Release

- [ ] Weitere Skill-Leitern: One-Arm Pull-up · Human Flag · V-Sit/Manna-Vorstufen · Dragon Flag · Shrimp Squat · Nordic Curl
- [ ] Skizzen/3D-Clips für alle neuen Stufen (Pipeline in `art/`)
- [ ] Adaptiv: Volumen-Anpassung nach letzter Leistung, Deload-Erkennung (Stagnation über 2+ Einheiten), Rotation im Zubehör-Block
- [ ] Readiness-Check vor der Einheit (Schlaf/Energie/Gelenke, 3 Taps) → Tagesanpassung
- [ ] Statistiken: Volumen-Trends, Zeit unter Spannung, Kraft-zu-Gewicht
- [ ] KI-Unterstützung (Sprachmodell, immer als Vorschlag mit Bestätigung): Freitext → Phase/Verletzung, Erklärung der Skill-Vorschläge, Wochenrückblick aus Notizen
- [ ] Plan selbst bleibt regelbasiert – kein ML für die Planung

### Später / bewusst nicht jetzt

- Android (Capacitor macht es möglich, erst nach stabilem iOS-Release)
- Trainer-/Team-Features, Plan-Sharing, Community
- Apple Watch

---

## Offene Fragen aus der v1-Phase (weiter beobachten)

1. Reicht regelbasierte Progression oder braucht es echte Tagesform-Anpassung? (→ beobachten, wie oft der Plan sich falsch anfühlt)
2. Wie oft wird der Technik-Toggle nach Woche 2 noch geöffnet? (→ entscheidet, wie viel in Lern-Inhalte investiert wird)
3. Werden die Zubehör-Übungen langweilig? (→ entscheidet Priorität der Rotation in 3.4)
4. ~~Cardio-Tracking in der App oder bewusst draußen lassen?~~ **Beantwortet (Aug 2026):** Rad und Lauf ersetzen regelmäßig geplante Einheiten — ohne Erfassung fehlte im Kalender die halbe Trainingswoche. Seit v1.12.0 drin, bewusst minimal (Art, Dauer, Distanz, Höhenmeter; keine Pace, kein GPS, keine Herzfrequenz).
