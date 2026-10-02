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

export interface Progression {
  id: ProgressionId;
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
  /** Array-Reihenfolge = Trainingsreihenfolge. v1 brauchte dafür `ord`. */
  slots: { block: Block; progression: ProgressionId }[];
  warmup: RoutineItem[];
  cooldown: RoutineItem[];
}

export interface Catalog {
  schema: 1;
  exercises: Exercise[];
  progressions: Progression[];
  workouts: Workout[];
  weekplan: Partial<Record<Weekday, WorkoutId>>;
}

/* ── Nutzerdaten ─────────────────────────────────────────────────────────── */

export interface SetLog {
  exercise: ExerciseId;         // die Historie folgt der Übung, egal wo sie im Plan steht
  progression: ProgressionId;   // Kontext: über welchen Slot sie trainiert wurde
  set: number;                  // Satznummer ab 1 (Lücken möglich)
  value: number;                // Wiederholungen oder Sekunden, je nach Übung
  weightKg?: number;
  attempts?: number;            // neu: Versuche, wenn nur Treffer gezählt werden
  note?: string;
}

export interface Session {
  id: string;                   // deterministisch `${date}-${workout}` → Import wiederholbar
  date: string;                 // YYYY-MM-DD, lokales Datum
  workout: WorkoutId;
  durationSec?: number;
  sets: SetLog[];
  skipped: ExerciseId[];
  routineDone: RoutineItemId[];
  /** heute geplante Satzzahl je Progression, wenn vom Ziel abgewichen wurde (± in
      der Ansicht). Noch nicht im Payload-Schema – kommt mit dem Sync. */
  setPlan?: Record<ProgressionId, number>;
  /** letzte Änderung in ms – Grundlage für den Sync */
  updatedAt?: number;
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
}

export interface UserState {
  /** aktuelle Stufe je Progression – als Übungs-ID, nicht als Index */
  current: Record<ProgressionId, ExerciseId>;
  paused: ProgressionId[];
}

export interface Dataset {
  schema: 1;
  source: { app: "v1"; exportVersion: number | null; exportedAt: string | null };
  sessions: Session[];
  activities: Activity[];
  state: UserState;
}
