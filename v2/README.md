# v2 – Fundament

Datenmodell, Katalog und Import für die nächste Version. **Noch keine App**, nur
die Datenebene, die später unter Payload und dem Offline-Client liegt. Keine
Dependencies: Node ≥ 22.18 führt TypeScript direkt aus.

## Leitregel

Jede Referenz läuft über eine **stabile ID**, nie über eine Position. In v1 hing
die Historie an Positionen wie `0-0@1`, und fünf Positionen haben ihre Bedeutung
bereits gewechselt. In v2 hängt jeder Satz an einer Übungs-ID wie
`chest-to-bar-pull-up` und folgt ihr, egal wo sie im Plan steht.

## Dateien

| Datei | Inhalt |
|---|---|
| `model.ts` | Typen: Katalog (Übungen, Progressionen, Workouts, Wochenplan) und Nutzerdaten (Sessions, Aktivitäten, Stand) |
| `catalog/catalog.json` | Der Katalog mit festen IDs – erzeugt aus v1 |
| `tools/extract-catalog.ts` | Erzeugt den Katalog aus `../index.html`. IDs stehen dort von Hand |
| `migrate/v1-positions.json` | v1-Position → Übungs-ID (Stand der letzten v1-Version) |
| `migrate/v1-history.ts` | Bedeutungswechsel von Positionen, belegt durch die Git-Historie |
| `migrate/from-v1.ts` | Import eines v1-Exports (version 3–5) in einen v2-Datensatz |
| `test/` | Tests mit erfundenen Daten – echte Exporte gehören nicht ins öffentliche Repo |

## Befehle

```bash
node --test v2/test/migrate.test.ts            # Tests
node v2/migrate/from-v1.ts export.json out.json # einen v1-Export importieren
node v2/tools/extract-catalog.ts                # Katalog nach Planänderung in v1 neu erzeugen
```

## Solange v1 im Einsatz ist

Die `index.html` bleibt der Ort, an dem der Plan geändert wird. Danach:

1. `node v2/tools/extract-catalog.ts` – bricht ab, wenn eine neue Übung noch keine ID
   hat (dann in `EXERCISE_IDS` ergänzen) oder eine bestehende ID verschwinden würde.
2. Hat eine v1-Position ihre Bedeutung gewechselt (andere Übung auf derselben
   Stufe), einen Eintrag mit Datum in `migrate/v1-history.ts` ergänzen.

## Weg zu Payload

- `exercises`, `progressions` (Stufen als Array mit Relation), `workouts`
  (Slots als Array mit Relation) → Collections; `weekplan` → Global.
  `catalog.json` ist der Seed.
- Nutzerdaten liegen im Client (IndexedDB) und synchronisieren als `sessions` /
  `activities` – die Trainings-App funktioniert vollständig ohne Netz.
- Session-IDs sind deterministisch (`datum-workout`), ein erneuter Import oder Sync
  überschreibt statt zu doppeln.
