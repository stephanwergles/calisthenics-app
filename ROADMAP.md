# ROADMAP

## Status quo (v1.4 — Juli 2026)

Single-File-App, feature-complete für die Selbst-Validierung:
3er-Split (23 Slots, 42 Progressionsstufen) · Satz-Logging mit Wdh./Sekunden/Zusatzgewicht · verdiente Freischaltungen (2× alle Sätze am Ziel) · Technik-Sektionen (Position, Ausführung, Fehler, Leichter/Schwerer, Kreide-Skizzen) · Pausen-Timer mit Auto-Start · Trainings-Session-Timer · Log mit Dauer · JSON-Export/Import.

Seit v1.4: Sätze pro Tag anpassbar (± direkt an der Übung) · erledigte Übungen klappen automatisch zu, die aktive ist hervorgehoben · Hold-Timer für Zeitübungen im Satz-Editor · Pausen-Timer zeitstempelbasiert (übersteht App-Suspend) · Zoom gesperrt · Lösch-Button mit Rückfrage (v1.4.1) · Versionsnummer im Header + In-App-Update-Check mit Neustart-Banner gegen iOS-PWA-Caching (v1.4.2) · Wake Lock: Display bleibt während laufender Session an (v1.5.0) · App-Icon + Favicon + Home-Bildschirm-Titel „Calisthenics" (v1.5.1; seit v1.5.2 Kreide-C statt Strichfigur) · Export-Erinnerung im Log, Einheiten im Log löschbar (v1.6.0) · Lösch-Button mit lokalem Datum + nur bei Bedarf sichtbar (v1.6.3/v1.6.4) · Offected-Farbschema: Orange #FF4D00 auf Schwarz #232323 (v1.7.0).

**Aktuelle Phase: 6–8 Wochen mit v1 trainieren und Daten sammeln.** Jede Feature-Idee in dieser Zeit landet hier statt im Code — erst am Ende der Phase wird anhand der eigenen Logs entschieden, was v2 wirklich braucht.

---

## v1.x — kleine Verbesserungen (nur bei echtem Bedarf im Training)

- [ ] Deload-Erinnerung: Hinweis-Banner alle 4 Wochen bzw. wenn Werte über 2+ Einheiten stagnieren
- [ ] Warm-up-Checkliste pro Tag (aktuell nur im Markdown-Plan, nicht in der App)
- [ ] Wochenübersicht im Log (Einheiten/Woche, Gesamtvolumen, Gesamtzeit)
- [ ] Satz-Notizen (Freitext, z.B. „Ellenbogen gezwickt") — Vorstufe der v2-Regenerationslogik
- [ ] Service-Worker für garantiertes Offline (aktuell nur Browser-Cache)
- [ ] Optional: Barlow Condensed via Google Fonts wieder aktivieren (auf Pages kein CSP-Problem; Offline-Fallback bleibt System-Stack)

**Nicht in v1.x:** alles was Sync, Accounts oder Backend braucht.

---

## v2 — die echte App (Next.js + Payload CMS)

**Startkriterium:** v1-Validierung abgeschlossen (regelmäßig trainiert, Logs zeigen welche Features fehlen) **und** mindestens ein konkreter Bedarf, den v1 nicht abdecken kann (typischerweise: Sync über Geräte, oder die adaptive Planung).

### Phase 2.0 — Fundament
- Monorepo/Projekt-Setup: Next.js (App Router) + Payload 3 + Postgres, Deployment auf eigener Infra (Ploi/Hetzner — bestehender Agentur-Stack)
- Payload-Collections aus dem v1-Datenmodell ableiten (die Struktur ist 1:1 übertragbar):
  - `exercises` (heutige Levels: Name, Technik-Texte, Skizze/Medien, Ziel, Einheit, Gewichts-Flag)
  - `progressions` (heutige Slots: geordnete Liste von exercises + Unlock-Kriterium)
  - `plans` (Tage → Slots, Blöcke, Pausenzeiten)
  - `sessions` / `setLogs` (heutiges Log-Format; Import-Script für die v1-JSON-Exports)
  - `users` (Payload-Auth)
- v1-Feature-Parität als PWA (installierbar, offline-first mit Sync-Queue)
- **Meilenstein: eigener Umstieg von v1 auf v2 mit importierter Historie**

### Phase 2.1 — Adaptive Planung (der eigentliche Kern der App-Idee)
- Regelbasierte Session-Generierung statt statischem Plan: Volumen-Anpassung nach letzter Leistung, automatische Deload-Erkennung, Übungsrotation im Zubehör-Block
- Readiness-Check vor der Einheit (Schlaf/Energie/Gelenke, 3 Taps) → Tagesanpassung
- Skill-Tree-Visualisierung über alle Progressionen (die Ladder aus v1, aber als Graph)
- Erst Regeln, kein ML — die v1/v2-Daten sind die Grundlage, um Regeln überhaupt formulieren zu können

### Phase 2.2 — Inhalte & Politur
- Echte Übungsmedien (eigene Videos/Fotos statt Kreide-SVGs — selbst produzierbar, keine Rechteprobleme)
- Warm-up-Routinen als eigene Plan-Blöcke
- Statistiken: Volumen-Trends, Zeit unter Spannung, Kraft-zu-Gewicht (InBody-Werte manuell erfassbar)

### Phase 2.3 — nur falls aus dem Projekt ein Produkt werden soll
- Multi-User, Onboarding mit Level-Einstufung, Plan-Templates
- Trainer-/Team-Features, Sharing
- Entscheidung bewusst vertagt: erst wenn v2 den eigenen Anwendungsfall monatelang trägt

---

## Offene Fragen (während der v1-Phase beantworten)

1. Reicht regelbasierte Progression oder braucht es echte Tagesform-Anpassung? (→ beobachten, wie oft der Plan sich falsch anfühlt)
2. Wie oft wird der Technik-Toggle nach Woche 2 noch geöffnet? (→ entscheidet, wie viel v2 in Lern-Inhalte investiert)
3. Werden die Zubehör-Übungen langweilig? (→ entscheidet Priorität der Übungsrotation in 2.1)
4. Cardio-Tracking in der App oder bewusst draußen lassen?
