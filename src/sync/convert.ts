/* Übersetzung zwischen Payload-Dokumenten und dem App-Modell – rein, ohne
   Payload-Import. Genutzt vom Sync-Endpunkt, vom Seed-Skript und von den Tests.

   Payload liefert leere Felder als null, Relationen je nach depth als ID oder
   Objekt und Array-Zeilen mit eigener `id`. Das App-Modell kennt nichts davon. */
import type { Activity, Catalog, Exercise, Progression, Session, SetLog, Target, UserState, Workout, Weekday } from '../domain/model.ts'

type Doc = Record<string, any>
const idOf = (v: any): string => (v && typeof v === 'object' ? v.id : v)
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined || (v as unknown) === '' ? undefined : v)
/** entfernt undefined-Felder, damit Vergleiche und JSON sauber bleiben */
const tidy = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/* ── Nutzerdaten ─────────────────────────────────────────────────────────── */

export function docToSession(d: Doc): Session {
  return tidy({
    id: d.key as string,
    date: d.date as string,
    workout: idOf(d.workout),
    durationSec: opt<number>(d.durationSec),
    sets: (d.sets ?? []).map((s: Doc): SetLog => tidy({
      exercise: idOf(s.exercise), progression: idOf(s.progression), set: s.set, value: s.value,
      weightKg: opt<number>(s.weightKg), attempts: opt<number>(s.attempts), note: opt<string>(s.note),
    })),
    skipped: (d.skipped ?? []).map(idOf),
    routineDone: d.routineDone ?? [],
    setPlan: opt(d.setPlan),
    updatedAt: opt<number>(d.clientUpdatedAt),
  })
}

export const sessionToDoc = (s: Session) => ({
  key: s.id, date: s.date, workout: s.workout, durationSec: s.durationSec ?? null,
  sets: s.sets.map(x => ({
    exercise: x.exercise, progression: x.progression, set: x.set, value: x.value,
    weightKg: x.weightKg ?? null, attempts: x.attempts ?? null, note: x.note ?? null,
  })),
  skipped: s.skipped, routineDone: s.routineDone, setPlan: s.setPlan ?? null,
  clientUpdatedAt: s.updatedAt ?? 0,
})

export function docToActivity(d: Doc): Activity {
  return tidy({
    id: d.key as string, date: d.date as string, kind: d.kind,
    name: opt<string>(d.name), durationMin: opt<number>(d.durationMin), distanceKm: opt<number>(d.distanceKm),
    elevationM: opt<number>(d.elevationM), rounds: opt<number>(d.rounds), note: opt<string>(d.note),
    updatedAt: opt<number>(d.clientUpdatedAt),
  })
}

export const activityToDoc = (a: Activity) => ({
  key: a.id, date: a.date, kind: a.kind, name: a.name ?? null, durationMin: a.durationMin ?? null,
  distanceKm: a.distanceKm ?? null, elevationM: a.elevationM ?? null, rounds: a.rounds ?? null,
  note: a.note ?? null, clientUpdatedAt: a.updatedAt ?? 0,
})

export function docToState(state: Doc | null | undefined): UserState {
  return tidy({
    current: (state?.current ?? {}) as Record<string, string>,
    paused: (state?.paused ?? []).map(idOf),
    updatedAt: opt<number>(state?.clientUpdatedAt),
  })
}

/* ── Eingaben prüfen (kommen vom Gerät, also nicht vertrauen) ─────────────── */

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isId = (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v)
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

export function isSession(s: any): s is Session {
  return !!s && isId(s.id) && isDate(s.date) && isId(s.workout) && s.id === `${s.date}-${s.workout}`
    && Array.isArray(s.sets) && s.sets.length <= 300
    && s.sets.every((x: any) => x && isId(x.exercise) && isId(x.progression) && isNum(x.set) && isNum(x.value))
    && Array.isArray(s.skipped) && s.skipped.every(isId)
    && Array.isArray(s.routineDone) && s.routineDone.every(isId)
}
export function isActivity(a: any): a is Activity {
  return !!a && isId(a.id) && isDate(a.date) && ['run', 'ride', 'workout'].includes(a.kind)
}
export function isState(s: any): s is UserState {
  return !!s && typeof s.current === 'object' && Object.entries(s.current).every(([k, v]) => isId(k) && isId(v))
    && Array.isArray(s.paused) && s.paused.every(isId)
}

/* ── Katalog ─────────────────────────────────────────────────────────────── */

/** Katalog → Payload-Daten (für das Seed-Skript) */
export function catalogToDocs(c: Catalog) {
  return {
    exercises: c.exercises.map(({ id, ...rest }) => ({ id, data: rest })),
    progressions: c.progressions.map(p => ({ id: p.id, data: { steps: p.steps } })),
    workouts: c.workouts.map(w => ({
      id: w.id,
      data: {
        name: w.name, focus: w.focus, slots: w.slots,
        warmup: w.warmup.map(({ id, name, detail, cardio }) => ({ key: id, name, detail, cardio: !!cardio })),
        cooldown: w.cooldown.map(({ id, name, detail, cardio }) => ({ key: id, name, detail, cardio: !!cardio })),
      },
    })),
    weekplan: c.weekplan,
  }
}

/** Payload-Dokumente → Katalog im App-Format */
export function buildCatalog(exs: Doc[], progs: Doc[], works: Doc[], week: Doc | null): Catalog {
  const target = (t: Doc): Target => tidy({
    label: t.label, sets: t.sets, min: opt<number>(t.min), max: opt<number>(t.max),
    restSec: t.restSec, unlockAt: t.unlockAt ?? null,
  })
  const routine = (rows: Doc[] | null) => (rows ?? []).map(r => tidy({
    id: r.key as string, name: r.name as string, detail: (r.detail ?? '') as string, cardio: r.cardio ? true : undefined,
  }))
  const weekplan: Catalog['weekplan'] = {}
  for (const d of WEEKDAYS) if (week?.[d]) weekplan[d] = idOf(week[d])
  return {
    schema: 1,
    exercises: exs.map((e): Exercise => ({
      id: e.id, name: e.name, unit: e.unit, weighted: !!e.weighted, perSide: !!e.perSide,
      technique: {
        setup: e.technique?.setup ?? '', execution: e.technique?.execution ?? '',
        faults: e.technique?.faults ?? '', scaling: e.technique?.scaling ?? '',
      },
      media: tidy({ sketch: opt<string>(e.media?.sketch), videoQuery: opt<string>(e.media?.videoQuery) }),
    })),
    progressions: progs.map((p): Progression => ({
      id: p.id, steps: (p.steps ?? []).map((s: Doc) => ({ exercise: idOf(s.exercise), target: target(s.target ?? {}) })),
    })),
    workouts: works.map((w): Workout => ({
      id: w.id, name: w.name, focus: w.focus ?? '',
      slots: (w.slots ?? []).map((s: Doc) => ({ block: s.block, progression: idOf(s.progression) })),
      warmup: routine(w.warmup), cooldown: routine(w.cooldown),
    })),
    weekplan,
  }
}

/** Mindestprüfung, bevor ein Katalog vom Server den eingebauten ersetzt */
export function catalogUsable(c: Catalog | undefined | null): c is Catalog {
  if (!c || !c.workouts?.length || !c.progressions?.length || !c.exercises?.length) return false
  const ex = new Set(c.exercises.map(e => e.id)), pr = new Set(c.progressions.map(p => p.id))
  return c.progressions.every(p => p.steps.length > 0 && p.steps.every(s => ex.has(s.exercise)))
    && c.workouts.every(w => w.slots.every(s => pr.has(s.progression)))
}

/* ── Protokoll ───────────────────────────────────────────────────────────── */

export interface SyncRequest {
  /** Serverzeit der letzten erfolgreichen Synchronisation; null = erster Sync */
  since: string | null
  catalogVersion: string | null
  sessions: Session[]
  activities: Activity[]
  deletedActivities: string[]
  state: UserState | null
}
export interface SyncResponse {
  serverTime: string
  sessions: Session[]
  activities: Activity[]
  state: UserState
  catalogVersion: string
  catalog?: Catalog
  rejected: string[]
}
