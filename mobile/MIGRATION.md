# Lever Expo-App – Portierung

Die Expo-App (`mobile/`) ersetzt die Capacitor-App (`ios/`, `src/client/native.ts`, Swift-Sheets)
als nächste Version derselben App (Bundle-ID `de.offected.lever`). Fachlogik, Zustand und Texte
kommen aus dem gemeinsamen Kern `src/core` (Import `@lever/core/...`), nur die Oberfläche ist neu.

## Aufbau

- `src/app/` – nur Routen (Expo Router). Tabs: `(tabs)/(today|plan|skills|log)`, Sheets und Modals im Root-Stack (`_layout.tsx`)
- `src/screens/` – Screen-Inhalte, `src/components/` – geteilte App-Bausteine, `src/ui/` – Design-System
- `src/state/app.tsx` – `useApp()`: `t` (Training), `ps` (Planvorschlag), `rest` (Pausen-Timer), Sprache, slots/Fokus, start/finish
- `src/platform.ts` – Adapter für den Kern (SQLite, SecureStore, Netz, Benachrichtigungen, Ton, Haptik)
- `src/navigation.tsx` – `formSheet()`, `modal()`, `stackScreenOptions`, `HeaderButton`/`CloseButton` (native Glas-Buttons)
- Clips: `scripts/media.js` erzeugt `src/media/clips.generated.ts` aus `../public/clips` (läuft aus `app.config.ts`)

## Screens

| Bereich | Web-Vorlage | Expo-Route | Stand |
|---|---|---|---|
| Heute | `HomeView` | `(tabs)/(today)/index` → `screens/today.tsx` | ✅ |
| Session-Leiste | `BottomBar` | `NativeTabs.BottomAccessory` → `components/session-bar.tsx` | ✅ |
| Training (Fokus, Pause, Halte-Timer) | `FocusView`, `RestOverlay` | `training` | ☐ |
| Satz erfassen | `SetSheet` | `set` | ☐ |
| Technik & Optionen | `ExerciseSheet` | `exercise` | ☐ |
| Übungsplan heute | `PlanSheet` (WorkoutView) | `exercises` | ☐ |
| Zusammenfassung | `SummaryOverlay` | `summary/[id]` | ☐ |
| Plan-Tab | `PlanView` | `(tabs)/(plan)/index` | ☐ |
| Phasen | `PhaseSheet` | `phase` | ☐ |
| Planvorschlag | `SuggestionSheet` | `suggestion` | ☐ |
| Vorlagen | `TemplatesSheet` | `templates/*` | ☐ |
| Meine Workouts / Editor | `PlanEditor` | `workouts/*` | ☐ |
| Skills-Tab, Skill-Seite | `SkillsView`, `SkillDetail` | `(tabs)/(skills)/index`, `skill/[id]` | ☐ |
| Progressions-Leiter | `SkillSheet` | `progression/[pid]` | ☐ |
| Log (Kalender, Verlauf, Fortschritt) | `HistoryView` | `(tabs)/(log)/index` | ☐ |
| Tag im Verlauf | `DaySheet` | `day/[id]` | ☐ |
| Cardio | `ActivitySheet` | `activity` | ☐ |
| Profil (Ziele, Ausrüstung, Tage, Einstufung, Sprache, Feedback, Konto, Daten) | `ProfileSheet`, `ProfileParts`, `DataView` | `profile/*` | ☐ |
| Onboarding | `Onboarding` | `onboarding/*` | ☐ |
| Gesundheits-Hinweis / Einwilligung | `ConsentGate` | `consent`, `screens/gates.tsx` | ☐ |

## Feedback, das in der Expo-App umgesetzt wird (14.10.)

- Ring-Muscle-up erscheint als „realistisch“, obwohl der Muscle-up noch nicht erreicht ist → Voraussetzung „Muscle-up erreicht“ in den Skill-Daten; Niveau nicht an der schwersten Einzelübung messen
- Erreichte Skills (z. B. Dips mit Gewicht, freigeschaltet) nicht mehr als Ziel anbieten → eigene Gruppe „Erreicht“
- Klimmzüge mit Gewicht ist Voraussetzung des Muscle-ups → bei gewähltem Muscle-up „steckt schon in Muscle-up“ statt eigenes Ziel
- Mehr als drei Ziele zulassen (Grenze über das Zeitbudget statt fester Zahl)
- Pistol in der Einstufung: echte Radio-Buttons
- Wochenaufbau: statt Erklärtext eine Vorschau der konkreten Woche je Option (was an welchem Tag drankommt)
- Sheet-Inhalt skaliert beim Öffnen (Capacitor) → mit nativen Expo-Sheets erledigt, prüfen

## Regeln

- Kern (`src/core`) nicht mit Plattformcode belasten; neue Texte in die Wörterbücher `src/core/i18n/{de,en}/<bereich>.ts` (beide Sprachen, gleiche Schlüssel)
- Nur Bausteine aus `@/ui` (Tokens, Buttons, Karten, Listen); keine Text-Glyphen als Icons
- Touch-Ziele ≥ 44 pt, VoiceOver-Labels, „Fläche oder Rand = anfassbar“
- Prüfen: `npx tsc --noEmit` in `mobile/`, im Repo-Root `npm test` und `npx tsc --noEmit -p .`
