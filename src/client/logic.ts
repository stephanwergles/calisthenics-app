/* Trainingslogik der v2-App – rein funktional, ohne React, DOM oder Speicher.
   Die Oberfläche ruft diese Funktionen auf; getestet wird direkt mit node --test. */
import type {
  Activity, Catalog, Exercise, ExerciseId, Progression, ProgressionId, Session, SetLog,
  Target, UserState, Weekday, Workout, WorkoutId,
} from '../domain/model.ts'

export const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const WEEKDAY_SHORT: Record<Weekday, string> = { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' }
/** Anzeige-Reihenfolge: Woche beginnt Montag */
export const WEEK_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** Lokales Datum YYYY-MM-DD. Nie toISOString – UTC verschiebt den Tag nach Mitternacht. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const weekdayOf = (date: string): Weekday => WEEKDAYS[new Date(`${date}T12:00`).getDay()]
export const sessionId = (date: string, workout: WorkoutId) => `${date}-${workout}`

/* ── Katalog ─────────────────────────────────────────────────────────────── */

export interface Index {
  catalog: Catalog
  exercises: Map<ExerciseId, Exercise>
  progressions: Map<ProgressionId, Progression>
  workouts: Map<WorkoutId, Workout>
}
export function indexCatalog(catalog: Catalog): Index {
  return {
    catalog,
    exercises: new Map(catalog.exercises.map(e => [e.id, e])),
    progressions: new Map(catalog.progressions.map(p => [p.id, p])),
    workouts: new Map(catalog.workouts.map(w => [w.id, w])),
  }
}

export interface Step { index: number; total: number; exercise: Exercise; target: Target; next?: Exercise; prev?: Exercise }
/** Aktuelle Stufe einer Progression. Ohne Eintrag (oder wenn die Übung nicht mehr
    in der Progression steht) gilt die erste Stufe. */
export function currentStep(ix: Index, state: UserState, pid: ProgressionId): Step {
  const p = ix.progressions.get(pid)!
  const found = p.steps.findIndex(s => s.exercise === state.current[pid])
  const index = found < 0 ? 0 : found
  const ex = (i: number) => (p.steps[i] ? ix.exercises.get(p.steps[i].exercise) : undefined)
  return { index, total: p.steps.length, exercise: ex(index)!, target: p.steps[index].target, next: ex(index + 1), prev: ex(index - 1) }
}

/** Wochentage, an denen ein Workout laut Plan dran ist (Montag zuerst) */
export const plannedDays = (ix: Index, workout: WorkoutId) =>
  WEEK_ORDER.filter(d => ix.catalog.weekplan[d] === workout)

/** Workouts in Wochenreihenfolge ihres ersten Plantags */
export function workoutsInWeekOrder(ix: Index): Workout[] {
  const first = (w: Workout) => { const d = plannedDays(ix, w.id)[0]; return d ? WEEK_ORDER.indexOf(d) : 99 }
  return [...ix.workouts.values()].sort((a, b) => first(a) - first(b))
}

const trained = (s: Session) => s.sets.length > 0 || s.durationSec !== undefined

/** Empfehlung: laut Wochenplan; an freien Tagen das Workout mit der längsten Pause */
export function recommendWorkout(ix: Index, sessions: Session[], date: string): WorkoutId {
  const planned = ix.catalog.weekplan[weekdayOf(date)]
  if (planned) return planned
  const last = (w: WorkoutId) => sessions.filter(s => s.workout === w && s.date < date && trained(s))
    .reduce((m, s) => (s.date > m ? s.date : m), '')
  return [...ix.workouts.keys()].sort((a, b) => (last(a) < last(b) ? -1 : last(a) > last(b) ? 1 : 0))[0]
}

/* ── Historie ────────────────────────────────────────────────────────────── */

export const setsOf = (s: Session | undefined, exercise: ExerciseId): SetLog[] =>
  (s?.sets ?? []).filter(x => x.exercise === exercise).sort((a, b) => a.set - b.set)

/** Letzte Einheit vor `before`, in der die Übung trainiert wurde – egal über welchen Slot */
export function lastPerformance(sessions: Session[], exercise: ExerciseId, before: string) {
  const s = sessions.filter(x => x.date < before && x.sets.some(y => y.exercise === exercise))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return s ? { date: s.date, sets: setsOf(s, exercise) } : null
}

/** Freischaltung: die letzten zwei vollständigen Einheiten dieser Übung mit jedem
    Satz ≥ unlockAt. Vollständig = mindestens so viele Sätze wie vorgegeben. */
export function readyToProgress(sessions: Session[], exercise: ExerciseId, target: Target): boolean {
  if (target.unlockAt == null) return false
  const complete = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(s => setsOf(s, exercise)).filter(sets => sets.length >= target.sets)
  return complete.length >= 2 && complete.slice(-2).every(sets => sets.every(x => x.value >= target.unlockAt!))
}

/* ── Heutige Einheit ─────────────────────────────────────────────────────── */

export const plannedSets = (s: Session | undefined, pid: ProgressionId, target: Target) =>
  s?.setPlan?.[pid] ?? target.sets

export type SlotState = 'open' | 'done' | 'skipped' | 'paused'
export function slotState(s: Session | undefined, exercise: ExerciseId, planned: number, paused: boolean): SlotState {
  if (paused) return 'paused'
  if (s?.skipped.includes(exercise)) return 'skipped'
  return setsOf(s, exercise).length >= planned ? 'done' : 'open'
}

export function emptySession(date: string, workout: WorkoutId): Session {
  return { id: sessionId(date, workout), date, workout, sets: [], skipped: [], routineDone: [] }
}
const touch = (s: Session): Session => ({ ...s, updatedAt: Date.now() })

export function withSet(s: Session, set: SetLog): Session {
  const rest = s.sets.filter(x => !(x.exercise === set.exercise && x.set === set.set))
  return touch({ ...s, sets: [...rest, set], skipped: s.skipped.filter(e => e !== set.exercise) })
}
export const withoutSet = (s: Session, exercise: ExerciseId, set: number): Session =>
  touch({ ...s, sets: s.sets.filter(x => !(x.exercise === exercise && x.set === set)) })
export const withSkip = (s: Session, exercise: ExerciseId, on: boolean): Session =>
  touch({ ...s, skipped: on ? [...new Set([...s.skipped, exercise])] : s.skipped.filter(e => e !== exercise) })
export const withPlan = (s: Session, pid: ProgressionId, n: number): Session =>
  touch({ ...s, setPlan: { ...s.setPlan, [pid]: Math.max(1, n) } })
export const withRoutine = (s: Session, item: string, on: boolean): Session =>
  touch({ ...s, routineDone: on ? [...new Set([...s.routineDone, item])] : s.routineDone.filter(i => i !== item) })
export const withDuration = (s: Session, seconds: number): Session =>
  touch({ ...s, durationSec: Math.round((s.durationSec ?? 0) + seconds) })

/** Vorbelegung des Satz-Editors: heutiger Wert → gleicher Satz der letzten Einheit
    → vorheriger Satz heute → oberes Ziel bzw. Freischalt-Schwelle */
export function prefill(today: SetLog[], last: SetLog[], setNo: number, target: Target, ex: Exercise) {
  const pick = today.find(x => x.set === setNo) ?? last.find(x => x.set === setNo) ?? today.find(x => x.set === setNo - 1)
  if (pick) return { value: pick.value, weightKg: pick.weightKg ?? 0 }
  return { value: target.max ?? target.unlockAt ?? (ex.unit === 'seconds' ? 10 : 8), weightKg: 0 }
}

/** Erste offene Übung in Trainingsreihenfolge – die „aktive“ */
export function firstOpen(states: { pid: ProgressionId; state: SlotState }[]): ProgressionId | undefined {
  return states.find(x => x.state === 'open')?.pid
}

export const hasActivity = (activities: Activity[], date: string) => activities.some(a => a.date === date)

/* ── Formatierung ────────────────────────────────────────────────────────── */

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`
export function fmtDuration(sec: number) {
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
export const fmtDate = (date: string) =>
  new Date(`${date}T12:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
export const fmtSet = (x: SetLog, ex: Exercise) =>
  `${x.value}${ex.unit === 'seconds' ? ' s' : ''}${x.weightKg ? ` +${x.weightKg} kg` : ''}`
export const fmtRest = (sec: number) => (sec >= 60 ? `${fmtClock(sec)} min` : `${sec} s`)

/* ── Ansicht eines Workouts ──────────────────────────────────────────────── */

export const BLOCK_LABEL: Record<string, string> = { skill: 'Skill', strength: 'Kraft', core: 'Core', accessory: 'Zubehör', extra: 'Extra' }

export interface SlotView {
  pid: ProgressionId
  block: string
  step: Step
  planned: number
  sets: SetLog[]
  state: SlotState
  last: { date: string; sets: SetLog[] } | null
  ready: boolean
}

/** Alles, was die Ansicht pro Slot braucht – in Trainingsreihenfolge */
export function workoutSlots(ix: Index, workout: WorkoutId, user: UserState, today: Session | undefined, sessions: Session[], date: string): SlotView[] {
  return ix.workouts.get(workout)!.slots.map(sl => {
    const step = currentStep(ix, user, sl.progression)
    const paused = user.paused.includes(sl.progression)
    const planned = plannedSets(today, sl.progression, step.target)
    return {
      pid: sl.progression, block: sl.block, step, planned,
      sets: setsOf(today, step.exercise.id),
      state: slotState(today, step.exercise.id, planned, paused),
      last: lastPerformance(sessions, step.exercise.id, date),
      ready: !paused && !!step.next && readyToProgress(sessions, step.exercise.id, step.target),
    }
  })
}

/* ── Verlauf: Kalender ───────────────────────────────────────────────────── */

/** Einheit zählt als trainiert, sobald ein Satz oder eine Dauer drinsteht */
export const isTrained = (s: Session) => s.sets.length > 0 || (s.durationSec ?? 0) > 0

/** Tage mit Einheit bzw. Aktivität, für die Markierungen im Kalender */
export function calendarMarks(sessions: Session[], activities: Activity[]) {
  return {
    trained: new Set(sessions.filter(isTrained).map(s => s.date)),
    cardio: new Set(activities.map(a => a.date)),
  }
}

/** Monatsraster mit Wochenstart Montag: `lead` leere Zellen, dann alle Tage als YYYY-MM-DD */
export function monthGrid(month: string): { lead: number; days: string[] } {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const count = new Date(y, m, 0).getDate()
  return { lead, days: Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`) }
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const fmtMonth = (month: string) =>
  new Date(`${month}-15T12:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
export const fmtShortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.`

/** Sätze einer Einheit gruppiert nach Übung, in Trainingsreihenfolge des Workouts
    (Übungen, die nicht mehr im Plan stehen, hinten dran) */
export function sessionExercises(ix: Index, s: Session): { exercise: Exercise; sets: SetLog[] }[] {
  const order = new Map<ExerciseId, number>()
  ix.workouts.get(s.workout)?.slots.forEach((sl, i) =>
    ix.progressions.get(sl.progression)?.steps.forEach(st => order.set(st.exercise, i)))
  const ids = [...new Set(s.sets.map(x => x.exercise))]
    .sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
  return ids.flatMap(id => {
    const exercise = ix.exercises.get(id)
    return exercise ? [{ exercise, sets: setsOf(s, id) }] : []
  })
}

const ACTIVITY_LABEL: Record<Activity['kind'], string> = { run: 'Lauf', ride: 'Rad', workout: 'Workout' }
export const activityTitle = (a: Activity) => a.name || ACTIVITY_LABEL[a.kind]
export const fmtActivity = (a: Activity) => [
  a.durationMin ? `${a.durationMin} min` : null,
  a.distanceKm ? `${String(a.distanceKm).replace('.', ',')} km` : null,
  a.elevationM ? `${a.elevationM} hm` : null,
  a.rounds ? `${a.rounds} Runden` : null,
].filter(Boolean).join(' · ')

/* ── Verlauf: Fortschritt ────────────────────────────────────────────────── */

export interface HistoryPoint {
  date: string
  exercise: ExerciseId
  step: number          // Stufe innerhalb der Progression (0-basiert)
  sets: SetLog[]
  sum: number           // so denkt man selbst: „in Summe mehr geworden“
  best: number
  weightKg: number
}

/** Verlauf einer Progression über alle Stufen: je Einheit Summe, bester Satz, höchstes Zusatzgewicht.
    Die Historie folgt der Übungs-ID – egal, über welches Workout sie trainiert wurde. */
export function progressionHistory(ix: Index, sessions: Session[], pid: ProgressionId): HistoryPoint[] {
  const steps = ix.progressions.get(pid)?.steps ?? []
  const out: HistoryPoint[] = []
  for (const s of sessions) {
    steps.forEach((st, step) => {
      const sets = setsOf(s, st.exercise)
      if (!sets.length) return
      out.push({
        date: s.date, exercise: st.exercise, step, sets,
        sum: sets.reduce((n, x) => n + x.value, 0),
        best: Math.max(...sets.map(x => x.value)),
        weightKg: Math.max(0, ...sets.map(x => x.weightKg ?? 0)),
      })
    })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.step - b.step))
}

export interface ProgressSummary {
  pid: ProgressionId
  step: Step
  history: HistoryPoint[]
  current: HistoryPoint[]          // nur Einheiten der aktuellen Stufe
  last?: HistoryPoint
  prev?: HistoryPoint
  delta: number | null             // Summe letzte minus vorletzte Einheit derselben Stufe
  best: number | null
  weightKg: number
  paused: boolean
  ready: boolean
}

export function progressSummary(ix: Index, user: UserState, sessions: Session[], pid: ProgressionId): ProgressSummary {
  const step = currentStep(ix, user, pid)
  const history = progressionHistory(ix, sessions, pid)
  const current = history.filter(h => h.exercise === step.exercise.id)
  const last = current.at(-1), prev = current.at(-2)
  const paused = user.paused.includes(pid)
  return {
    pid, step, history, current, last, prev,
    delta: last && prev ? last.sum - prev.sum : null,
    best: current.length ? Math.max(...current.map(h => h.best)) : null,
    weightKg: Math.max(0, ...current.map(h => h.weightKg)),
    paused,
    ready: !paused && !!step.next && readyToProgress(sessions, step.exercise.id, step.target),
  }
}

/** Fortschritt aller Workouts in Wochenreihenfolge; Progressionen ohne Historie fallen weg */
export function progressOverview(ix: Index, user: UserState, sessions: Session[]) {
  return workoutsInWeekOrder(ix).map(w => ({
    workout: w,
    tiles: w.slots.map(sl => progressSummary(ix, user, sessions, sl.progression)).filter(p => p.history.length > 0),
  })).filter(g => g.tiles.length > 0)
}
