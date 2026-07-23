# CLAUDE.md

## Projekt

Calisthenics-Trainings-App. **v1 ist eine einzelne, komplett self-contained `index.html`** (kein Build, keine Dependencies, keine externen Requests außer YouTube-Links), deployed auf GitHub Pages, genutzt als PWA-artige App auf dem Handy im Gym. v1 dient der Selbst-Validierung: 6–8 Wochen echte Trainingsdaten sammeln, bevor v2 (Next.js + Payload CMS) gebaut wird.

**Nutzer & Kontext:** Ein Nutzer (der Entwickler selbst), 39, trainiert 3×/Woche abends ~90 Min. Level: 8–10 Klimmzüge, 20 Dips, kurzer L-Sit. Ziele: Muscle-up, längerer L-Sit, „shredded" statt „bulked" (Erhaltung bis leichtes Defizit). Trainingsphilosophie der App: Skill-Arbeit zuerst, Progressionsleitern statt zufälliger Varianz, verdiente Freischaltungen, Sehnenschutz (wichtig ab Ende 30).

## Architektur von index.html

Eine Datei, drei Abschnitte: `<style>`, HTML-Gerüst, `<script>`. Einzige Zusatzdatei im Repo: `apple-touch-icon.png` (180×180, Home-Bildschirm-Icon — iOS akzeptiert dafür keine Daten-URIs; Kreide-C auf Graphit). Der Browser-Favicon ist dieselbe Grafik als Inline-SVG-Daten-URI im `<head>`. **Bei jeder Icon-Änderung den `?v=`-Cache-Buster in der `apple-touch-icon`-URL hochzählen** — Safari cached die Datei sonst über Neuinstallationen hinweg. Kein Framework, Vanilla JS, komplettes Re-Rendering über `render()` bei jeder State-Änderung.

### Datenmodell (im Script, Konstante `PLAN`)

```
PLAN = [ Tag ] → Tag = { name, sub, slots: [ Slot ] }
Slot = { block: "Skill"|"Kraft"|"Core"|"Zubehör"|"Extra", levels: [ Level ] }
Level = { name, reps, rest(s), query(YouTube-Suche), svg(Key in SVGS),
          pos, exec, fehler, reg,        // Technik-Texte (deutsch)
          up: number|null,               // Freischalt-Schwelle pro Satz
          opts?: { w?: 1, t?: 1 } }      // w = Zusatzgewicht-Feld, t = Sekunden statt Wdh.
```

- **Slot** = fester Platz im Trainingsplan, **Level** = Progressionsstufe (z.B. Body Rows → Tuck Front Lever Rows). 23 Slots, 42 Levels.
- `SLOTS` ist die flache Lookup-Map: `"di-si"` → Slot.
- **LogKeys:** Level 0 loggt unter `"di-si"` (Legacy-kompatibel), Level N>0 unter `"di-si@N"`. `parseLogKey()` löst beides auf. Jede Stufe hat getrennte Historie.

### localStorage-Keys

| Key | Inhalt |
|---|---|
| `cali-log` | `{ logKey: [ { d: "YYYY-MM-DD", s: [ [wert, gewicht] \| null ], n?: Satzzahl-Override für den Tag } ] }` |
| `cali-prog` | `{ slotKey: aktuellerLevelIndex }` |
| `cali-sess` | laufende Session `{ start: timestamp, day: di }` oder `null` |
| `cali-durs` | `{ datum: { day, dur(sekunden) } }` |
| `cali-day` | aktiver Tab (0–2 = Trainingstage, 3 = Log) |
| `cali-exp` | Datum des letzten JSON-Exports (für die Export-Erinnerung im Log) |

Alle Zugriffe über den `store`-Wrapper (try/catch, damit die Datei auch in Umgebungen ohne localStorage nicht crasht). JSON-Export/Import im Log-Tab (`version: 3`, enthält `log`, `prog`, `durs`) — **das Export-Format ist das geplante Seed-Format für die v2-Datenbank.**

### Kernlogik

- **`readyToProgress(slotKey)`**: true, wenn die letzten **2** vollständigen Einheiten der aktuellen Stufe in **allen** Sätzen ≥ `up` waren → Bernstein-Unlock-Button. `up: null` = nie automatisch (nur manuell über die Ladder im Technik-Toggle).
- **Satz-Editor**: Tap auf Satz-Kreis → Bottom-Sheet mit Steppern. Prefill-Kaskade: heutiger Wert → gleicher Satz der letzten Einheit → vorheriger Satz heute → `up` bzw. 10s. Speichern startet den Pausen-Timer der Übung und (falls keine läuft) die Trainings-Session.
- **Session-Timer**: Zeit über `Date.now() - start` berechnet (übersteht Reload/Display-aus). Sessions < 60 s werden verworfen, mehrere pro Tag summiert.
- **SVGs**: schematische Kreide-Strichfiguren, inline im `SVGS`-Dict, Figur = `#e9e7df`, Gerät/Boden = `#f2c94c`. Keine externen Bilder (CSP der Claude-Vorschau + Offline-Anspruch + Bildrechte).

## Design-Tokens

Offected-Palette (seit v1.7.0): neutrales Schwarz mit Signal-Orange als einziger Signalfarbe, Kreideweiß für Erledigtes („eingekreidet", mit Staubrand-Box-Shadow). **Die CSS-Var-Namen `--amber`/`--chalk` sind historisch und bleiben** — `--amber` ist jetzt das Orange:

```
--bg #232323 · --card #2a2a2a · --card2 #323232 · --line #3d3d3d
--text #ededed · --muted #979797 · --amber #FF4D00 · --chalk #f4f4f4
```

Typo: System-Stack, Display-Stil über `font-stretch: condensed` + Uppercase (Klasse `.display`). **Bewusst keine Webfonts** — Offline-Fähigkeit schlägt Typo-Feinheit in v1. Mobile-first, `prefers-reduced-motion` respektiert, Safe-Area-Insets an fixen Leisten.

## Konventionen

- UI-Sprache Deutsch, Nutzeransprache **du**. Deutsche Anführungszeichen „…“ in Texten — **Achtung:** in JS-Strings niemals mit ASCII-`"` schließen (hat schon einmal 9 Syntaxfehler produziert).
- Übungstexte folgen dem Schema: `pos` (Ausgangsposition, 1 Satz) → `exec` (Ausführung, 2–3 Sätze) → `fehler` (2–3 mit `·` getrennt) → `reg` („Leichter: … Schwerer: …").
- Keine externen Ressourcen einbauen (einzige Ausnahme: YouTube-Links, die in neuem Tab öffnen).
- Die Versionsnummer steht im Header (`<span>Progressionsbasiert · vX.Y.Z</span>`) und wird bei **jedem** Push erhöht (Patch für Fixes/Kleinkram, Minor für Features) — sie ist das Erkennungszeichen, welcher Stand auf dem Handy wirklich läuft.
- Vor Abschluss: JS aus der Datei extrahieren, `node --check`, dann Smoke-Test mit DOM-Stub (Muster liegt in der bisherigen Historie: `makeEl()`-Stub, `eval(app + tests)` im selben Scope, localStorage-Mock der wirft → try/catch-Pfade testen).

## Deployment

GitHub Pages: Repo → `index.html` in `main` → Settings → Pages → Deploy from branch. Keine Build-Pipeline. Handy: „Zum Startbildschirm hinzufügen".

## Was v1 bewusst NICHT bekommt

Externe DB/Auth (→ v2 mit Payload), echte Fotos/Videos, Tagesform-/Regenerationslogik, Multi-User. Wenn ein Feature localStorage-Gefrickel über ~50 Zeilen erfordert oder Sync braucht: nicht in v1 bauen, in ROADMAP.md unter v2 eintragen.
