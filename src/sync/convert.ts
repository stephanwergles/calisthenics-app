/* Übersetzung zwischen Payload-Dokumenten und dem App-Modell – rein, ohne
   Payload-Import. Genutzt vom Sync-Endpunkt, vom Seed-Skript und von den Tests.

   Payload liefert leere Felder als null, Relationen je nach depth als ID oder
   Objekt und Array-Zeilen mit eigener `id`. Das App-Modell kennt nichts davon. */
import { NOTE_MAX } from '../domain/model.ts'
import type { Activity, Catalog, Exercise, Phase, Plan, Profile, Progression, Session, SetLog, Target, UserState, Workout, Weekday } from '../domain/model.ts'

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
    // Plan-Schlüssel; ältere Einheiten kennen nur die Katalog-Verknüpfung
    workout: (d.workoutKey as string) || idOf(d.workout),
    durationSec: opt<number>(d.durationSec),
    sets: (d.sets ?? []).map((s: Doc): SetLog => tidy({
      exercise: idOf(s.exercise), progression: idOf(s.progression), set: s.set, value: s.value,
      weightKg: opt<number>(s.weightKg), attempts: opt<number>(s.attempts), note: opt<string>(s.note),
    })),
    skipped: (d.skipped ?? []).map(idOf),
    routineDone: d.routineDone ?? [],
    setPlan: opt(d.setPlan),
    added: d.adjust?.added?.length ? d.adjust.added as string[] : undefined,
    removed: d.adjust?.removed?.length ? d.adjust.removed as string[] : undefined,
    note: opt<string>(d.note),
    updatedAt: opt<number>(d.clientUpdatedAt),
    deleted: d.deleted === true ? true : undefined,
  })
}

export const sessionToDoc = (s: Session) => ({
  key: s.id, date: s.date, workoutKey: s.workout, workout: s.workout, durationSec: s.durationSec ?? null,
  sets: s.sets.map(x => ({
    exercise: x.exercise, progression: x.progression, set: x.set, value: x.value,
    weightKg: x.weightKg ?? null, attempts: x.attempts ?? null, note: x.note ?? null,
  })),
  skipped: s.skipped, routineDone: s.routineDone, setPlan: s.setPlan ?? null, note: s.note ?? null,
  adjust: s.added?.length || s.removed?.length ? tidy({ added: s.added?.length ? s.added : undefined, removed: s.removed?.length ? s.removed : undefined }) : null,
  clientUpdatedAt: s.updatedAt ?? 0, deleted: s.deleted === true,
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

export function docToPlan(d: Doc): Plan {
  return tidy({
    id: d.key as string, version: d.version ?? 1, name: d.name ?? 'Mein Plan', source: d.source ?? 'custom',
    workouts: (d.workouts ?? []) as Workout[], weekplan: (d.weekplan ?? {}) as Plan['weekplan'],
    inputs: opt(d.inputs) as Plan['inputs'], updatedAt: opt<number>(d.clientUpdatedAt),
  })
}

export const planToDoc = (p: Plan) => ({
  key: p.id, version: p.version, name: p.name, source: p.source, workouts: p.workouts, weekplan: p.weekplan,
  inputs: p.inputs ?? null, clientUpdatedAt: p.updatedAt ?? 0,
})

export function docToState(state: Doc | null | undefined): UserState {
  return tidy({
    current: (state?.current ?? {}) as Record<string, string>,
    paused: (state?.paused ?? []).map(idOf),
    profile: opt(state?.profile) as UserState['profile'],
    phases: (state?.phases as UserState['phases'])?.length ? state!.phases : undefined,
    updatedAt: opt<number>(state?.clientUpdatedAt),
  })
}

/* ── Eingaben prüfen (kommen vom Gerät, also nicht vertrauen) ─────────────── */

const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isId = (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v)
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

/** Notizen: optional, Text, höchstens NOTE_MAX Zeichen */
export { NOTE_MAX }
const isNote = (v: any) => v === undefined || (typeof v === 'string' && v.length <= NOTE_MAX)
export function isSession(s: any): s is Session {
  return !!s && isId(s.id) && isDate(s.date) && isId(s.workout) && s.id === `${s.date}-${s.workout}`
    && Array.isArray(s.sets) && s.sets.length <= 300
    && s.sets.every((x: any) => x && isId(x.exercise) && isId(x.progression) && isNum(x.set) && isNum(x.value) && isNote(x.note))
    && isNote(s.note) && (s.deleted === undefined || typeof s.deleted === 'boolean')
    && Array.isArray(s.skipped) && s.skipped.every(isId)
    && Array.isArray(s.routineDone) && s.routineDone.every(isId)
    && isIds(s.added) && isIds(s.removed)
}
/** optionale Liste von IDs (Tagesanpassung) */
const isIds = (v: any) => v === undefined || (Array.isArray(v) && v.length <= 30 && v.every(isId))
const isFlag = (v: any) => v === undefined || typeof v === 'boolean'
const isSlot = (s: any) => !!s && isId(s.progression) && typeof s.block === 'string'
  && (s.sets === undefined || (Number.isInteger(s.sets) && s.sets >= 1 && s.sets <= 10))
  && (s.reason === undefined || (typeof s.reason === 'string' && s.reason.length <= 120))
const isRoutine = (r: any) => !!r && isId(r.id) && typeof r.name === 'string' && r.name.length <= 200
export function isPlan(p: any): p is Plan {
  return !!p && isId(p.id) && Number.isInteger(p.version) && typeof p.name === 'string' && p.name.length <= 80
    && ['catalog', 'generated', 'custom'].includes(p.source)
    && Array.isArray(p.workouts) && p.workouts.length <= 14
    && p.workouts.every((w: any) => w && isId(w.id) && typeof w.name === 'string' && w.name.length <= 80 && typeof w.focus === 'string'
      && Array.isArray(w.slots) && w.slots.length <= 30 && w.slots.every(isSlot) && isFlag(w.custom) && isFlag(w.archived)
      && Array.isArray(w.warmup) && w.warmup.every(isRoutine) && Array.isArray(w.cooldown) && w.cooldown.every(isRoutine))
    && !!p.weekplan && typeof p.weekplan === 'object'
    && Object.entries(p.weekplan).every(([d, w]) => WEEKDAYS.includes(d as Weekday) && p.workouts.some((x: any) => x.id === w && !x.archived))
}
export function isActivity(a: any): a is Activity {
  return !!a && isId(a.id) && isDate(a.date) && ['run', 'ride', 'workout'].includes(a.kind)
}
export function isState(s: any): s is UserState {
  return !!s && typeof s.current === 'object' && Object.entries(s.current).every(([k, v]) => isId(k) && isId(v))
    && Array.isArray(s.paused) && s.paused.every(isId)
    && (s.profile === undefined || isProfile(s.profile))
    && (s.phases === undefined || (Array.isArray(s.phases) && s.phases.length <= 50 && s.phases.every(isPhase)))
}
const TENDONS = ['wrist', 'elbow', 'shoulder', 'knee']
export function isPhase(p: any): p is Phase {
  return !!p && isId(p.id) && ['pause', 'vacation', 'injury', 'equipment'].includes(p.kind) && isDate(p.from)
    && (p.to === undefined || (isDate(p.to) && p.to >= p.from))
    && (p.tendons === undefined || (Array.isArray(p.tendons) && p.tendons.every((t: any) => TENDONS.includes(t))))
    && (p.equipment === undefined || (Array.isArray(p.equipment) && p.equipment.every((e: any) => EQUIPMENT.includes(e))))
    && isNote(p.note)
}
const EQUIPMENT = ['bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'floor', 'wall']
export function isProfile(p: any): p is Profile {
  return !!p && Array.isArray(p.goals) && p.goals.length <= 3 && p.goals.every(isId)
    && Array.isArray(p.equipment) && p.equipment.every((e: any) => EQUIPMENT.includes(e))
    && Array.isArray(p.days) && p.days.length <= 7 && p.days.every((d: any) => WEEKDAYS.includes(d))
    && Number.isInteger(p.minutes) && p.minutes >= 15 && p.minutes <= 180
    && (p.split === undefined || isId(p.split))
    && (p.assessment === undefined || (!!p.assessment && isDate(p.assessment.date) && typeof p.assessment.results === 'object'
      && Object.entries(p.assessment.results).every(([k, v]) => isId(k) && isNum(v) && (v as number) >= 0 && (v as number) <= 1000)))
}

/* ── Katalog ─────────────────────────────────────────────────────────────── */

/** Katalog → Payload-Daten (für das Seed-Skript) */
export function catalogToDocs(c: Catalog) {
  return {
    exercises: c.exercises.map(({ id, ...rest }) => ({ id, data: rest })),
    progressions: c.progressions.map(p => ({ id: p.id, data: { steps: p.steps, region: p.region ?? null } })),
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
      ...(e.cues?.length ? { cues: e.cues as string[] } : {}),
      ...(e.muscles?.length ? { muscles: e.muscles as string[] } : {}),
    })),
    progressions: progs.map((p): Progression => ({
      id: p.id, ...(p.region ? { region: p.region } : {}), steps: (p.steps ?? []).map((s: Doc) => ({ exercise: idOf(s.exercise), target: target(s.target ?? {}) })),
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
  /** eigener Plan, nur wenn lokal geändert (ältere Apps schicken ihn nie) */
  plan?: Plan | null
}
export interface SyncResponse {
  serverTime: string
  sessions: Session[]
  activities: Activity[]
  state: UserState
  catalogVersion: string
  catalog?: Catalog
  rejected: string[]
  /** eigener Plan (null = es gilt der Katalog-Plan) */
  plan?: Plan | null
}
