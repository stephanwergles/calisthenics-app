/* ──────────────────────────────────────────────────────────────────────────
   v2-Datenmodell

   Leitregel: Jede Referenz läuft über eine stabile ID, nie über eine Position.
   In v1 hing die Historie an Positionen wie „0-0@1" (Tag 0, Slot 0, Stufe 1) –
   jede Planänderung konnte sie still an die falsche Übung hängen. IDs sind
   kleingeschriebene Slugs, werden einmal vergeben und nie umbenannt oder
   wiederverwendet. Ein umbenannter Anzeigename ändert die ID nicht.

   Zwei Hälften:
   - Katalog (Übungen, Progressionen, Workouts, Wochenplan) → später Payload-CMS
   - Nutzerdaten (Sessions, Aktivitäten, Stand) → lokal (IndexedDB) + Sync
   ────────────────────────────────────────────────────────────────────────── */

export type ExerciseId = string;
export type ProgressionId = string;
export type WorkoutId = string;
export type RoutineItemId = string;
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Block = "skill" | "strength" | "core" | "accessory" | "extra";

/* ── Katalog ─────────────────────────────────────────────────────────────── */

export interface Exercise {
  id: ExerciseId;
  name: string;
  unit: "reps" | "seconds";
  weighted: boolean;            // Zusatzgewicht erfassbar
  perSide: boolean;             // Werte gelten pro Seite
  technique: { setup: string; execution: string; faults: string; scaling: string };
  media: { sketch?: string; videoQuery?: string };
  /** bis zu drei kurze Kernpunkte für den Blick zwischen zwei Sätzen (src/seed/coaching.json) */
  cues?: string[];
  /** Hauptmuskeln bzw. Schwerpunkte, wichtigste zuerst */
  muscles?: string[];
}

/** Vorgabe einer Stufe. Gehört zur Progression, nicht zur Übung: Dieselbe Übung
    kann in einem anderen Plan andere Ziele haben. */
export interface Target {
  label: string;                // Originaltext, z. B. "4 × 6–8"
  sets: number;
  min?: number;                 // fehlt bei „max“-Vorgaben
  max?: number;
  restSec: number;
  unlockAt: number | null;      // jeder Satz ≥ unlockAt in 2 Einheiten → nächste Stufe
}

/** Körperregion einer Progression – gruppiert den Skill-Tree */
export type Region = "pull" | "push" | "core" | "legs";
export const REGIONS: { id: Region; label: string; detail: string }[] = [
  { id: "pull", label: "Ziehen", detail: "Rücken, Bizeps, Griff" },
  { id: "push", label: "Drücken", detail: "Brust, Schultern, Trizeps" },
  { id: "core", label: "Rumpf", detail: "Bauch, Hüftbeuger" },
  { id: "legs", label: "Beine", detail: "Oberschenkel, Gesäß, Waden" },
];

export interface Progression {
  id: ProgressionId;
  region?: Region;
  steps: { exercise: ExerciseId; target: Target }[];
}

export interface RoutineItem {
  id: RoutineItemId;
  name: string;
  detail: string;
  cardio?: boolean;             // öffnet die Cardio-Erfassung statt eines Häkchens
}

export interface Workout {
  id: WorkoutId;
  name: string;
  focus: string;
  /** Array-Reihenfolge = Trainingsreihenfolge. v1 brauchte dafür `ord`.
      `sets` (nur im eigenen Plan) überschreibt die Satzzahl der Stufe. */
  slots: { block: Block; progression: ProgressionId; sets?: number; reason?: string }[];
  warmup: RoutineItem[];
  cooldown: RoutineItem[];
  /** nur im eigenen Plan: selbst angelegt (statt aus dem Katalog/Generator) */
  custom?: boolean;
  /** nur im eigenen Plan: gelöscht – bleibt für Namen und Reihenfolge im Verlauf erhalten */
  archived?: boolean;
}

export interface Catalog {
  schema: 1;
  exercises: Exercise[];
  progressions: Progression[];
  workouts: Workout[];
  weekplan: Partial<Record<Weekday, WorkoutId>>;
  /* v3, aus Payload (fehlen sie, nutzt die App die mitgelieferten Seed-Daten) */
  meta?: Record<ExerciseId, ExerciseMeta>;
  skills?: Skill[];
  splits?: SplitTemplate[];
  assessment?: AssessmentData;
}

/* ── Nutzerdaten ─────────────────────────────────────────────────────────── */

/** Persönlicher Plan (pro Person, synchronisiert). Fehlt er, gilt der Plan aus dem Katalog –
    so bleibt jeder bestehende Plan unverändert, bis die Person ihn selbst ändert. */
export interface Plan {
  id: string;                   // „main“ – später evtl. mehrere
  version: number;              // jede bestätigte Änderung +1
  name: string;
  source: "catalog" | "generated" | "custom";
  workouts: Workout[];          // gleiche Form wie im Katalog; Workout-IDs sind Plan-Schlüssel
  weekplan: Partial<Record<Weekday, WorkoutId>>;
  /** Eingaben, aus denen der Plan erzeugt wurde (Generator) */
  inputs?: { skills: string[]; equipment: string[]; days: Weekday[]; minutes: number; split?: string };
  updatedAt?: number;
}


export interface SetLog {
  exercise: ExerciseId;         // die Historie folgt der Übung, egal wo sie im Plan steht
  progression: ProgressionId;   // Kontext: über welchen Slot sie trainiert wurde
  set: number;                  // Satznummer ab 1 (Lücken möglich)
  value: number;                // Wiederholungen oder Sekunden, je nach Übung
  weightKg?: number;
  attempts?: number;            // neu: Versuche, wenn nur Treffer gezählt werden
  note?: string;
}

/** Höchstlänge einer Notiz (Satz oder Einheit) – App und Server prüfen dasselbe */
export const NOTE_MAX = 500;

export interface Session {
  id: string;                   // deterministisch `${date}-${workout}` → Import wiederholbar
  date: string;                 // YYYY-MM-DD, lokales Datum
  workout: WorkoutId;
  durationSec?: number;
  sets: SetLog[];
  skipped: ExerciseId[];
  routineDone: RoutineItemId[];
  /** Tagesanpassung: nur für diese Einheit hinzugefügte bzw. weggelassene Leitern */
  added?: ProgressionId[];
  removed?: ProgressionId[];
  /** heute geplante Satzzahl je Progression, wenn vom Ziel abgewichen wurde (± in der Ansicht) */
  setPlan?: Record<ProgressionId, number>;
  /** Freitext zur ganzen Einheit, z. B. „schlecht geschlafen, Schulter links zwickt“ */
  note?: string;
  /** letzte Änderung in ms – Grundlage für den Sync */
  updatedAt?: number;
  /** gelöscht: bleibt als leere Markierung erhalten, damit das Löschen per Sync auf allen Geräten ankommt */
  deleted?: boolean;
}

export interface Activity {
  id: string;
  date: string;
  kind: "run" | "ride" | "workout";
  name?: string;                // z. B. „Cindy“
  durationMin?: number;
  distanceKm?: number;
  elevationM?: number;
  rounds?: number;
  note?: string;
  /** letzte Änderung in ms – Grundlage für den Sync */
  updatedAt?: number;
}

/** Profil: Eingaben für Skill- und Planvorschläge. Fehlt es, gibt es noch keine Ziele. */
export interface Profile {
  goals: SkillId[];             // 0–3 Ziel-Skills
  equipment: Equipment[];       // vorhandene Geräte (floor/wall gelten immer)
  days: Weekday[];              // gewünschte Trainingstage
  minutes: number;              // Budget je Einheit inkl. Warm-up
  split?: string;               // Split-Vorlage; fehlt = automatisch (suggestSplits)
  /** letzter Kurztest: Ergebnis je Test-ID (Wdh., Sekunden oder Level-Index) */
  assessment?: { date: string; results: Record<string, number> };
}

/** Phase: Zeitraum, in dem der Plan anders gilt. `to` fehlt = bis auf Weiteres (bis „Beenden“). */
export type PhaseKind = "pause" | "vacation" | "injury" | "equipment";
export interface Phase {
  id: string;                   // z. B. "2026-10-14-injury"
  kind: PhaseKind;
  from: string;                 // YYYY-MM-DD
  to?: string;                  // letzter Tag (inklusive)
  tendons?: Tendon[];           // Verletzung: betroffene Sehnen/Gelenke
  equipment?: Equipment[];      // Equipment-Phase: was in dieser Zeit da ist
  note?: string;
}

export interface UserState {
  /** aktuelle Stufe je Progression – als Übungs-ID, nicht als Index */
  current: Record<ProgressionId, ExerciseId>;
  paused: ProgressionId[];
  profile?: Profile;
  phases?: Phase[];
  /** letzte Änderung in ms – Grundlage für den Sync */
  updatedAt?: number;
}

export interface Dataset {
  schema: 1;
  source: { app: "v1"; exportVersion: number | null; exportedAt: string | null };
  sessions: Session[];
  activities: Activity[];
  state: UserState;
}

/* ── v3-Prototyp: Training aus Skills (Generator, src/domain/generator.ts) ── */

export type Equipment = "bar" | "rings" | "parallettes" | "dip-bars" | "band" | "box" | "weight" | "floor" | "wall";
/** kleines, festes Set an Bewegungsmustern – Grundlage für ausgeglichene Pläne */
export type Pattern = "vertical-pull" | "horizontal-pull" | "vertical-push" | "horizontal-push" | "squat" | "hinge" | "core" | "isolation";
export type Tendon = "wrist" | "elbow" | "shoulder" | "knee";

export interface ExerciseMeta {
  /** Alternativen – jede eine Liste nötiger Geräte; floor und wall gelten als immer vorhanden */
  equipment: Equipment[][];
  pattern: Pattern;
  difficulty: number;            // 1–5
  stress: Partial<Record<Tendon, number>>; // 0–2 je Sehne
  unsure?: string;               // fachlich zu prüfen
}

export type SkillId = string;
export interface Skill {
  id: SkillId;
  name: string;
  /** Leitern, die den Skill selbst trainieren (Skill-Slots) */
  targets: ProgressionId[];
  /** Leitern, die immer mittrainiert werden (z. B. Bar Dips für den Muscle-up) */
  support: ProgressionId[];
  /** Kraft-Voraussetzungen: andere Leiter mindestens auf Stufe minStep (0-basiert) */
  prerequisites: { progression: ProgressionId; minStep: number }[];
}

/** Split-Vorlage: ein Thema je Trainingstag mit erlaubten Regionen (src/seed/splits.json) */
/** Kurztest: Tests und je Leiter die Schwellen (thresholds[i] = Mindestwert für Stufe i+1) */
export interface AssessmentData {
  tests: { id: string; name: string; unit: 'reps' | 'seconds' | 'level'; levels?: string[] }[]
  rules: { progression: ProgressionId; test: string; thresholds: number[] }[]
}

export interface SplitTemplate { id: string; name: string; themes: { id: string; name: string; regions: Region[] }[] }

export interface GeneratorInput {
  skills: SkillId[];              // 1–3 Ziel-Skills
  /** Split-Vorlage (Anzahl Themen = Anzahl Tage); fehlt = Generator bildet Tagesthemen selbst */
  split?: string;
  equipment: Equipment[];
  days: Weekday[];                // Trainingstage
  minutes: number;                // Budget je Einheit inkl. Warm-up
  /** aktuelle Stufe (0-basiert) je Progression; fehlt = 0 */
  current: Record<ProgressionId, number>;
}

export type SlotKind = "skill" | "support" | "prerequisite" | "base" | "balance";
export interface PlanSlot {
  progression: ProgressionId;
  exercise: ExerciseId;
  kind: SlotKind;
  block: Block;
  sets: number;
  minutes: number;
  reason: string;                 // kurze Begründung, z. B. „Muscle-up“, „Ausgleich Druck“
}
export interface PlanDay { day: Weekday; restBefore: number; theme?: string; slots: PlanSlot[]; minutes: number }
export interface GeneratedPlan { days: PlanDay[]; warnings: string[] }
