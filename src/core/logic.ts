/* Trainingslogik der v2-App – rein funktional, ohne React, DOM oder Speicher.
   Die Oberfläche ruft diese Funktionen auf; getestet wird direkt mit node --test. */
import type {
  Activity, Catalog, Challenge, ChallengeId, Equipment, Exercise, ExerciseId, Plan, Profile, Progression, ProgressionId, Region, Session, SetLog,
  Skill, SkillId, Target, UserState, Weekday, Workout, WorkoutId, Circuit, CircuitId, CircuitResult, GeneratedPlan, GeneratorInput, SplitTemplate, Phase, PhaseKind, Tendon, ExerciseMeta, Template, MuscleArea, BodyArea,
} from '../domain/model.ts'
import { assignThemes, restDays, usable } from '../domain/generator.ts'
import { suggestSkills, suggestSplits, type SkillSuggestion } from '../domain/assessment.ts'
import { ACTIVITY_KINDS, MAX_GOALS, MUSCLE_AREAS, NOTE_MAX, REGIONS, TENDONS } from '../domain/model.ts'
import { intl, t, tn, type Key } from './i18n/index.ts'

export { NOTE_MAX }

export const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** Beschriftungen als Objekte mit Gettern: lesen immer in der aktuellen Sprache (i18n) */
function labels<K extends string>(keys: readonly K[], key: (k: K) => string): Record<K, string> {
  return Object.defineProperties({} as Record<K, string>,
    Object.fromEntries(keys.map(k => [k, { get: () => t(key(k) as Key), enumerable: true }])))
}
export const WEEKDAY_SHORT = labels(WEEKDAYS, d => `logic.weekday.${d}`)
export const WEEKDAY_LONG = labels(WEEKDAYS, d => `logic.weekdayLong.${d}`)
export const regionLabel = (id: Region | 'other' | undefined) => t(`logic.region.${id ?? 'other'}` as Key)
export const regionDetail = (id: Region | 'other' | undefined) => t(`logic.regionDetail.${id ?? 'other'}` as Key)
/** Zahl im Format der Sprache (Dezimalkomma im Deutschen) */
export const fmtNum = (n: number) => n.toLocaleString(intl())
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
/** Katalog mit dem eigenen Plan überlagert: dessen Workouts und Wochenplan statt der aus dem Katalog.
    Slots mit Leitern, die der Katalog nicht (mehr) kennt, fallen weg. Ohne Plan: der Katalog unverändert. */
export function effectiveCatalog(catalog: Catalog, plan: Plan | null | undefined): Catalog {
  if (!plan || !plan.workouts.length) return catalog
  const known = new Set(catalog.progressions.map(p => p.id))
  return { ...catalog, workouts: plan.workouts.map(w => ({ ...w, slots: w.slots.filter(s => known.has(s.progression)) })), weekplan: plan.weekplan }
}

/** Anzeigename einer Progression: eigener Name, sonst die letzte Stufe */
export function progressionName(ix: Index, pid: ProgressionId): string {
  const p = ix.progressions.get(pid)
  if (!p) return pid
  return p.name ?? ix.exercises.get(p.steps[p.steps.length - 1]?.exercise)?.name ?? pid
}

/** Plan aus dem Katalog als Ausgangspunkt für eigene Änderungen (gleiche Workouts, gleicher Wochenplan) */
export const planFromCatalog = (catalog: Catalog): Plan => ({
  id: 'main', version: 1, name: 'Mein Plan', source: 'catalog',
  workouts: structuredClone(catalog.workouts), weekplan: { ...catalog.weekplan },
})

/* ── Eigener Plan bearbeiten (jede Änderung ergibt einen neuen Plan, gespeichert wird in useTraining) ── */

/** stabiler Key aus dem Namen: Kleinbuchstaben, Umlaute ausgeschrieben, eindeutig im Plan */
export function workoutKey(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workout'
  let key = base, n = 2
  while (used.has(key)) key = `${base}-${n++}`
  return key
}
/** Fokuszeile aus den Körperregionen der Slots, z. B. „Ziehen · Rumpf“ */
export function focusOf(ix: Index, slots: { progression: ProgressionId }[]): string {
  const regions = new Set(slots.map(sl => ix.progressions.get(sl.progression)?.region).filter(Boolean))
  return REGIONS.filter(r => regions.has(r.id)).map(r => regionLabel(r.id)).join(' · ') || t('logic.customWorkout')
}
/** neues eigenes Workout (ohne Warm-up/Cool-down, solange keins übernommen wird) */
export function newWorkout(ix: Index, name: string, slots: Workout['slots'], from?: Workout): Workout {
  return {
    id: workoutKey(name, ix.workouts.keys()), name: name.trim().slice(0, 80) || t('logic.customWorkout'), focus: focusOf(ix, slots),
    slots, warmup: from ? structuredClone(from.warmup) : [], cooldown: from ? structuredClone(from.cooldown) : [], custom: true,
  }
}
/** heutige Einheit als neues Workout: angepasste Übungsliste, Satzzahlen des Tages, Warm-up/Cool-down des Ausgangs-Workouts */
export function workoutFromDay(ix: Index, workout: WorkoutId, s: Session | undefined, name: string): Workout {
  const slots = daySlots(ix, workout, s).map(({ added, ...sl }) => {
    const sets = s?.setPlan?.[sl.progression] ?? sl.sets
    return { block: added ? 'strength' as const : sl.block, progression: sl.progression, ...(sets ? { sets } : {}) }
  })
  return newWorkout(ix, name, slots, ix.workouts.get(workout))
}
/** Workout einfügen oder ersetzen (gleiche id) */
export const withWorkout = (plan: Plan, w: Workout): Plan => ({
  ...plan, workouts: plan.workouts.some(x => x.id === w.id) ? plan.workouts.map(x => (x.id === w.id ? w : x)) : [...plan.workouts, w],
})
/** Workout löschen: bleibt als gelöscht markiert (Verlauf kennt Namen und Reihenfolge weiter), fällt aus dem Wochenplan */
export const withoutWorkout = (plan: Plan, id: WorkoutId): Plan => ({
  ...plan,
  workouts: plan.workouts.map(w => (w.id === id ? { ...w, archived: true } : w)),
  weekplan: Object.fromEntries(Object.entries(plan.weekplan).filter(([, w]) => w !== id)),
})
/** Slot im Workout ändern, verschieben, entfernen, anhängen – eigene Workouts bekommen die Fokuszeile neu */
type Slots = Workout['slots']
const reslot = (ix: Index, w: Workout, slots: Slots): Workout => ({ ...w, slots, ...(w.custom ? { focus: focusOf(ix, slots) } : {}) })
export const withSlotSets = (ix: Index, w: Workout, pid: ProgressionId, sets: number): Workout =>
  reslot(ix, w, w.slots.map(sl => (sl.progression === pid ? { ...sl, sets: Math.min(10, Math.max(1, sets)) } : sl)))
export function movedSlot(ix: Index, w: Workout, pid: ProgressionId, by: -1 | 1): Workout {
  const i = w.slots.findIndex(sl => sl.progression === pid), j = i + by
  if (i < 0 || j < 0 || j >= w.slots.length) return w
  const slots = [...w.slots];[slots[i], slots[j]] = [slots[j], slots[i]]
  return reslot(ix, w, slots)
}
export const withoutSlot = (ix: Index, w: Workout, pid: ProgressionId): Workout => reslot(ix, w, w.slots.filter(sl => sl.progression !== pid))
export const withSlot = (ix: Index, w: Workout, pid: ProgressionId): Workout =>
  w.slots.some(sl => sl.progression === pid) ? w : reslot(ix, w, [...w.slots, { block: 'strength', progression: pid }])

/** Wochentag belegen (oder mit undefined freigeben) */
export function withDay(plan: Plan, day: Weekday, id: WorkoutId | undefined): Plan {
  const weekplan = { ...plan.weekplan }
  if (id) weekplan[day] = id; else delete weekplan[day]
  return { ...plan, weekplan }
}
/** Leitern zur Auswahl (Übung hinzufügen), nach Körperregion gruppiert, mit aktueller Stufe */
export function ladderChoices(ix: Index, user: UserState, exclude: Iterable<ProgressionId> = []) {
  const skip = new Set(exclude)
  const all = [...ix.progressions.values()].filter(p => !skip.has(p.id) && p.steps.length)
  return [...REGIONS.map(r => ({ id: r.id as string, label: regionLabel(r.id) })), { id: 'other', label: regionLabel('other') }].map(g => ({
    ...g,
    items: all.filter(p => (p.region ?? 'other') === g.id).map(p => {
      const step = currentStep(ix, user, p.id)
      return { pid: p.id, name: step.exercise.name, sub: t('logic.stageTarget', { i: step.index + 1, n: step.total, target: step.target.label }), exercise: step.exercise }
    }),
  })).filter(g => g.items.length)
}

export function indexCatalog(catalog: Catalog): Index {
  return {
    catalog,
    exercises: new Map(catalog.exercises.map(e => [e.id, e])),
    progressions: new Map(catalog.progressions.map(p => [p.id, p])),
    workouts: new Map(catalog.workouts.map(w => [w.id, w])),
  }
}

export interface Step { index: number; total: number; exercise: Exercise; target: Target; next?: Exercise; prev?: Exercise
  /** Ziel der nächsten Stufe – Sätze mit Zusatzgewicht zählen ab deren Mindestwert als geschafft */
  nextTarget?: Target }
/** Aktuelle Stufe einer Progression. Ohne Eintrag (oder wenn die Übung nicht mehr
    in der Progression steht) gilt die erste Stufe. */
/** Stufe eines Slots: die feste Übung, wenn eine gesetzt ist (und noch in der Leiter steht),
    sonst die aktuelle Stufe */
export function slotStep(ix: Index, state: UserState, sl: { progression: ProgressionId; exercise?: ExerciseId }): Step & { fixed?: boolean } {
  const p = ix.progressions.get(sl.progression)!
  const at = sl.exercise ? p.steps.findIndex(s => s.exercise === sl.exercise) : -1
  if (at < 0) return currentStep(ix, state, sl.progression)
  return { ...currentStep(ix, { ...state, current: { ...state.current, [sl.progression]: sl.exercise! } }, sl.progression), fixed: true }
}
/** feste Stufe setzen (oder mit undefined wieder mitwachsen lassen); legt den Slot bei Bedarf an */
export function withSlotExercise(ix: Index, w: Workout, pid: ProgressionId, exercise: ExerciseId | undefined): Workout {
  const base = withSlot(ix, w, pid)
  return reslot(ix, base, base.slots.map(sl => {
    if (sl.progression !== pid) return sl
    const { exercise: _old, ...rest } = sl
    return exercise ? { ...rest, exercise } : rest
  }))
}

export function currentStep(ix: Index, state: UserState, pid: ProgressionId): Step {
  const p = ix.progressions.get(pid)!
  const found = p.steps.findIndex(s => s.exercise === state.current[pid])
  const index = found < 0 ? 0 : found
  const ex = (i: number) => (p.steps[i] ? ix.exercises.get(p.steps[i].exercise) : undefined)
  return { index, total: p.steps.length, exercise: ex(index)!, target: p.steps[index].target, next: ex(index + 1), prev: ex(index - 1), nextTarget: p.steps[index + 1]?.target }
}

/** Wochentage, an denen ein Workout laut Plan dran ist (Montag zuerst) */
export const plannedDays = (ix: Index, workout: WorkoutId) =>
  WEEK_ORDER.filter(d => ix.catalog.weekplan[d] === workout)

/** Workouts in Wochenreihenfolge ihres ersten Plantags (gelöschte nicht) */
export function workoutsInWeekOrder(ix: Index): Workout[] {
  const first = (w: Workout) => { const d = plannedDays(ix, w.id)[0]; return d ? WEEK_ORDER.indexOf(d) : 99 }
  return [...ix.workouts.values()].filter(w => !w.archived).sort((a, b) => first(a) - first(b))
}

const trained = (s: Session) => s.sets.length > 0 || s.durationSec !== undefined || !!s.circuits?.length

/** Workouts für die Schnellauswahl: das heutige zuerst, dann nach letzter Einheit (neueste zuerst),
    nie trainierte in Wochenreihenfolge – höchstens n */
export function recentWorkouts(ix: Index, sessions: Session[], today: WorkoutId, n = 5): Workout[] {
  const last = new Map<WorkoutId, string>()
  for (const s of sessions) if (!s.deleted && trained(s) && (last.get(s.workout) ?? '') < s.date) last.set(s.workout, s.date)
  const order = workoutsInWeekOrder(ix)
  return [...order].sort((a, b) =>
    Number(b.id === today) - Number(a.id === today)
    || (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? '')
    || order.indexOf(a) - order.indexOf(b)).slice(0, n)
}

/** Empfehlung: laut Wochenplan; an freien Tagen das Workout mit der längsten Pause */
export function recommendWorkout(ix: Index, sessions: Session[], date: string): WorkoutId {
  const planned = ix.catalog.weekplan[weekdayOf(date)]
  if (planned) return planned
  const last = (w: WorkoutId) => sessions.filter(s => s.workout === w && s.date < date && trained(s))
    .reduce((m, s) => (s.date > m ? s.date : m), '')
  return workoutsInWeekOrder(ix).map(w => w.id).sort((a, b) => (last(a) < last(b) ? -1 : last(a) > last(b) ? 1 : 0))[0]
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

/** Satz erfüllt die Freischalt-Schwelle: Wert ≥ unlockAt – oder mit Zusatzgewicht mindestens der
    Mindestwert der nächsten Stufe (8 Dips mit +10 kg sind härter als 12 ohne; vorher schaltete das nie frei) */
export function meetsUnlock(x: SetLog, target: Target, next?: Target): boolean {
  if (target.unlockAt == null) return false
  return x.value >= target.unlockAt || (!!x.weightKg && next?.min != null && x.value >= next.min)
}

/** Freischaltung: die letzten zwei vollständigen Einheiten dieser Übung mit jedem
    Satz erfüllt (meetsUnlock). Vollständig = mindestens so viele Sätze wie vorgegeben. */
export function readyToProgress(sessions: Session[], exercise: ExerciseId, target: Target, next?: Target): boolean {
  if (target.unlockAt == null) return false
  const complete = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(s => setsOf(s, exercise)).filter(sets => sets.length >= target.sets)
  return complete.length >= 2 && complete.slice(-2).every(sets => sets.every(x => meetsUnlock(x, target, next)))
}

/* ── Heutige Einheit ─────────────────────────────────────────────────────── */

/** Satzzahl heute: Abweichung des Tages → Vorgabe im eigenen Workout → Ziel der Stufe */
export const plannedSets = (s: Session | undefined, pid: ProgressionId, target: Target, slotSets?: number) =>
  s?.setPlan?.[pid] ?? slotSets ?? target.sets

export type DaySlot = Workout['slots'][number] & { added?: boolean }
/** Slots der heutigen Einheit: das Workout ohne weggelassene, plus für heute hinzugefügte Leitern */
export function daySlots(ix: Index, workout: WorkoutId, s: Session | undefined): DaySlot[] {
  const base = (ix.workouts.get(workout)?.slots ?? []).filter(sl => !s?.removed?.includes(sl.progression))
  const have = new Set(base.map(sl => sl.progression))
  const extra = (s?.added ?? []).filter(pid => ix.progressions.has(pid) && !have.has(pid))
    .map((pid): DaySlot => ({ block: 'extra', progression: pid, added: true }))
  return [...base, ...extra]
}

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
/** Einheit löschen: Inhalt weg, Markierung bleibt (wird wie jede Änderung synchronisiert) */
export const deletedSession = (s: Session): Session => touch({ ...emptySession(s.date, s.workout), deleted: true })
/** Training abbrechen: Stand vor dem Start wiederherstellen (frühere Sätze desselben Tages bleiben),
    gab es keinen, die Einheit löschen. Ohne Einheit nichts zu tun. */
export function discardedSession(current: Session | undefined, before: Session | undefined): Session | undefined {
  if (!current || current.deleted) return undefined
  return before ? touch({ ...before, deleted: undefined }) : deletedSession(current)
}
/** gelöschte Einheiten zählen nirgends – wer sie wieder anfängt, beginnt leer */
export const live = (s: Session | undefined): Session | undefined => (s && !s.deleted ? s : undefined)

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
/** Tagesanpassung: Leiter nur heute dazunehmen (hebt ein Weglassen auf) */
export const withAdded = (s: Session, pid: ProgressionId): Session => touch(tidyAdjust({
  ...s, added: [...new Set([...(s.added ?? []), pid])], removed: (s.removed ?? []).filter(x => x !== pid),
}))
/** Tagesanpassung: Leiter heute weglassen (eine nur heute hinzugefügte fällt einfach wieder raus) bzw. zurückholen */
export const withRemoved = (s: Session, pid: ProgressionId, on: boolean): Session => touch(tidyAdjust(on
  ? (s.added ?? []).includes(pid)
    ? { ...s, added: s.added!.filter(x => x !== pid) }
    : { ...s, removed: [...new Set([...(s.removed ?? []), pid])] }
  : { ...s, removed: (s.removed ?? []).filter(x => x !== pid) }))
const tidyAdjust = (s: Session): Session => {
  const { added, removed, ...rest } = s
  return { ...rest, ...(added?.length ? { added } : {}), ...(removed?.length ? { removed } : {}) }
}
/** heute vom Workout abgewichen? */
export const isAdjusted = (s: Session | undefined) => !!(s?.added?.length || s?.removed?.length)
export const withRoutine = (s: Session, item: string, on: boolean): Session =>
  touch({ ...s, routineDone: on ? [...new Set([...s.routineDone, item])] : s.routineDone.filter(i => i !== item) })
export const withDuration = (s: Session, seconds: number): Session =>
  touch({ ...s, durationSec: Math.round((s.durationSec ?? 0) + seconds) })

/** Notizen: getrimmt, höchstens NOTE_MAX Zeichen (wie der Server prüft), leer = keine */
export const cleanNote = (v: string | undefined) => v?.trim().slice(0, NOTE_MAX) || undefined
export function withNote(s: Session, note: string): Session {
  const { note: _old, ...rest } = s
  const n = cleanNote(note)
  return touch(n ? { ...rest, note: n } : rest)
}
/** Satz-Notizen einer Satzliste, in Satzreihenfolge */
export const notesOf = (sets: SetLog[]) =>
  sets.filter(x => x.note).sort((a, b) => a.set - b.set).map(x => ({ set: x.set, note: x.note! }))

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

export const hasActivity = (activities: Activity[], date: string) => activities.some(a => a.date === date && a.kind !== 'challenge')
/** Cardio-Einheiten (Lauf, Rad, Workout) – ohne Challenges */
export const cardioOnly = (activities: Activity[]) => activities.filter(a => a.kind !== 'challenge')

/* ── Formatierung ────────────────────────────────────────────────────────── */

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`
export function fmtDuration(sec: number) {
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
export const fmtDate = (date: string) =>
  new Date(`${date}T12:00`).toLocaleDateString(intl(), { weekday: 'short', day: '2-digit', month: '2-digit' })
export const fmtSet = (x: SetLog, ex: Exercise) =>
  `${x.value}${ex.unit === 'seconds' ? ' s' : ''}${x.weightKg ? ` +${fmtNum(x.weightKg)} kg` : ''}`
export const fmtRest = (sec: number) => (sec >= 60 ? `${fmtClock(sec)} min` : `${sec} s`)

/* ── Ansicht eines Workouts ──────────────────────────────────────────────── */

export const BLOCK_LABEL: Record<string, string> = labels(['skill', 'strength', 'core', 'accessory', 'extra'] as const, b => `logic.block.${b}`)

export interface SlotView {
  pid: ProgressionId
  block: string
  step: Step
  planned: number
  sets: SetLog[]
  state: SlotState
  last: { date: string; sets: SetLog[] } | null
  ready: boolean
  /** nur heute hinzugefügt (Tagesanpassung) */
  added?: boolean
  /** ruht wegen einer Phase (Verletzung, fehlendes Gerät) */
  blockedBy?: string
  /** Ersatz für die ruhende Übung dieses Namens */
  substituteFor?: string
  /** feste Stufe im Workout (wächst nicht mit) */
  fixed?: boolean
}

/** Alles, was die Ansicht pro Slot braucht – in Trainingsreihenfolge */
export function workoutSlots(ix: Index, workout: WorkoutId, user: UserState, today: Session | undefined, sessions: Session[], date: string,
  opts: { meta?: Record<ExerciseId, ExerciseMeta> } = {}): SlotView[] {
  const phases = activePhases(user, date)
  const lighter = reentry(user, date)
  const view = (sl: DaySlot, substituteFor?: string): SlotView => {
    const step = slotStep(ix, user, sl)
    const blockedBy = opts.meta ? phaseBlock(phases, opts.meta[step.exercise.id], step.exercise.id) ?? undefined : undefined
    const paused = user.paused.includes(sl.progression) || !!blockedBy
    const base = plannedSets(undefined, sl.progression, step.target, sl.sets)
    const planned = today?.setPlan?.[sl.progression] ?? (lighter ? Math.max(2, base - 1) : base)
    return {
      pid: sl.progression, block: sl.block, step, planned, added: sl.added, blockedBy, substituteFor,
      sets: setsOf(today, step.exercise.id),
      state: slotState(today, step.exercise.id, planned, paused),
      last: lastPerformance(sessions, step.exercise.id, date),
      // feste Stufe: kein Freischalten (die Leiter läuft woanders weiter)
      ready: !paused && !step.fixed && !!step.next && readyToProgress(sessions, step.exercise.id, step.target, step.nextTarget),
      ...(step.fixed ? { fixed: true } : {}),
    }
  }
  const slots = daySlots(ix, workout, today)
  const taken = new Set(slots.map(sl => sl.progression))
  // ruhende Übung (Phase) → Ersatz mit gleichem Muster direkt dahinter
  return slots.flatMap(sl => {
    const v = view(sl)
    if (!v.blockedBy || !opts.meta) return [v]
    const sub = substituteFor(ix, user, phases, opts.meta, sl.progression, taken)
    if (!sub) return [v]
    taken.add(sub)
    return [v, view({ block: sl.block, progression: sub }, v.step.exercise.name)]
  })
}

/** Ersatz für eine ruhende Übung: Leiter mit gleichem Bewegungsmuster, die heute nicht ruht und
    nicht schon dran ist – gleiche Körperregion und ähnliche Schwierigkeit zuerst */
export function substituteFor(ix: Index, user: UserState, phases: Phase[], meta: Record<ExerciseId, ExerciseMeta>,
  pid: ProgressionId, exclude: Set<ProgressionId>): ProgressionId | null {
  const m = meta[currentStep(ix, user, pid).exercise.id]
  if (!m) return null
  const region = ix.progressions.get(pid)?.region
  return [...ix.progressions.values()]
    .filter(p => p.id !== pid && !exclude.has(p.id) && !user.paused.includes(p.id))
    .map(p => ({ p, id: currentStep(ix, user, p.id).exercise.id }))
    .map(x => ({ ...x, m: meta[x.id] }))
    .filter(x => x.m && x.m.pattern === m.pattern && (x.p.region === region || m.pattern !== 'isolation') && !phaseBlock(phases, x.m, x.id))
    .sort((a, b) => Number(b.p.region === region) - Number(a.p.region === region) || Math.abs(a.m.difficulty - m.difficulty) - Math.abs(b.m.difficulty - m.difficulty))[0]?.p.id ?? null
}

/* ── Verlauf: Kalender ───────────────────────────────────────────────────── */

/** Einheit zählt als trainiert, sobald ein Satz oder eine Dauer drinsteht */
export const isTrained = (s: Session) => s.sets.length > 0 || (s.durationSec ?? 0) > 0 || !!s.circuits?.length

/** Tage mit Einheit bzw. Aktivität, für die Markierungen im Kalender */
export function calendarMarks(sessions: Session[], activities: Activity[]) {
  return {
    trained: new Set(sessions.filter(isTrained).map(s => s.date)),
    cardio: new Set(cardioOnly(activities).map(a => a.date)),
    challenge: new Set(activities.filter(a => a.kind === 'challenge').map(a => a.date)),
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
  new Date(`${month}-15T12:00`).toLocaleDateString(intl(), { month: 'long', year: 'numeric' })
export const fmtShortDate = (date: string) => (intl() === 'de-DE' ? `${date.slice(8, 10)}.${date.slice(5, 7)}.`
  : new Date(`${date}T12:00`).toLocaleDateString(intl(), { day: 'numeric', month: 'short' }))

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

const ACTIVITY_LABEL = labels(ACTIVITY_KINDS, k => `logic.activity.${k}`)
export const activityKindLabel = (k: Activity['kind']) => ACTIVITY_LABEL[k]
export const activityTitle = (a: Activity) => a.name || ACTIVITY_LABEL[a.kind]
export const fmtActivity = (a: Activity) => a.kind === 'challenge' ? fmtChallengeActivity(a) : [
  a.durationMin ? `${a.durationMin} min` : null,
  a.distanceKm ? `${fmtNum(a.distanceKm)} km` : null,
  a.elevationM ? t('logic.elevation', { n: a.elevationM }) : null,
  a.rounds ? t('logic.rounds', { n: a.rounds }) : null,
].filter(Boolean).join(' · ')

/* ── Challenges ──────────────────────────────────────────────────────────── */

/** Vorlagen plus eigene Challenges (eigene zuerst) */
export const allChallenges = (templates: Challenge[], user: UserState): Challenge[] => [...(user.challenges ?? []), ...templates]
/** eigene Challenge anlegen/ersetzen (ID aus dem Namen + Zeitstempel, stabil nach dem Anlegen) */
export function withChallenge(user: UserState, c: Omit<Challenge, 'id' | 'custom'> & { id?: ChallengeId }): UserState {
  const id = c.id ?? `my-${c.name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'challenge'}-${Date.now().toString(36)}`
  const clean: Challenge = {
    id, name: c.name.trim().slice(0, 80), kind: c.kind, unit: c.kind === 'max' ? c.unit : 'reps', custom: true,
    ...(c.exercise ? { exercise: c.exercise } : {}),
    ...(c.kind === 'amrap' ? { seconds: Math.round(c.seconds ?? 60) } : {}),
    ...(c.kind === 'fortime' ? { target: Math.round(c.target ?? 50) } : {}),
  }
  const rest = (user.challenges ?? []).filter(x => x.id !== id)
  return { ...user, challenges: [clean, ...rest] }
}
export const withoutChallenge = (user: UserState, id: ChallengeId): UserState =>
  ({ ...user, challenges: (user.challenges ?? []).filter(x => x.id !== id) })

/** Was ein Versuch misst: Wiederholungen (so viele wie möglich, Maximum) oder Zeit (auf Zeit, Halten) */
export const challengeMeasuresTime = (c: Challenge) => c.kind === 'fortime' || c.unit === 'seconds'
/** Ergebnis als Text: „42 Wdh.“ oder „3:05“ */
export const fmtChallengeValue = (c: Challenge, value: number) =>
  challengeMeasuresTime(c) ? fmtClock(Math.round(value)) : t('logic.challenge.reps', { n: value })
/** Versuch im Verlauf: durationSec gesetzt ⇔ das Ergebnis ist eine Zeit (auf Zeit, Halten) */
const fmtChallengeActivity = (a: Activity) =>
  a.value === undefined ? '' : a.durationSec !== undefined ? fmtClock(Math.round(a.value)) : t('logic.challenge.reps', { n: a.value })
/** Vorgabe als Text: „2 min“, „100 Wdh. auf Zeit“, „so lange wie möglich“ */
export function fmtChallengeRule(c: Challenge): string {
  if (c.kind === 'amrap') return t('logic.challenge.amrap', { time: c.seconds! >= 60 && c.seconds! % 60 === 0 ? `${c.seconds! / 60} min` : `${c.seconds} s` })
  if (c.kind === 'fortime') return t('logic.challenge.fortime', { n: c.target ?? 0 })
  return c.unit === 'seconds' ? t('logic.challenge.maxHold') : t('logic.challenge.maxReps')
}
/** besser = mehr Wiederholungen bzw. länger gehalten; auf Zeit = schneller */
export const challengeBetter = (c: Challenge, a: number, b: number) => (c.kind === 'fortime' ? a < b : a > b)
/** Versuche einer Challenge, neueste zuerst */
export const challengeAttempts = (activities: Activity[], id: ChallengeId) =>
  activities.filter(a => a.kind === 'challenge' && a.challenge === id && a.value !== undefined)
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : (y.updatedAt ?? 0) - (x.updatedAt ?? 0)))
/** Bestwert (oder undefined) */
export function challengeBest(c: Challenge, activities: Activity[]): Activity | undefined {
  return challengeAttempts(activities, c.id).reduce<Activity | undefined>((best, a) => (!best || challengeBetter(c, a.value!, best.value!) ? a : best), undefined)
}
/** neuer Versuch als Aktivität (Sync wie Cardio); bei „auf Zeit“ ist value die Zeit in Sekunden */
export function challengeAttempt(c: Challenge, date: string, value: number, extra: { parts?: number[]; note?: string } = {}): Activity {
  const note = cleanNote(extra.note ?? '')
  const v = challengeMeasuresTime(c) ? Math.round(value) : value
  return {
    id: `${date}-${c.id}-${Date.now().toString(36)}`.slice(0, 80), date, kind: 'challenge', name: c.name, challenge: c.id, value: v,
    ...(challengeMeasuresTime(c) ? { durationSec: v } : {}),
    ...(extra.parts?.length ? { parts: extra.parts } : {}),
    ...(note ? { note } : {}),
    updatedAt: Date.now(),
  }
}

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
    ready: !paused && !!step.next && readyToProgress(sessions, step.exercise.id, step.target, step.nextTarget),
  }
}

/** Fortschritt aller Workouts in Wochenreihenfolge; Progressionen ohne Historie fallen weg */
export function progressOverview(ix: Index, user: UserState, sessions: Session[]) {
  return workoutsInWeekOrder(ix).map(w => ({
    workout: w,
    tiles: w.slots.map(sl => progressSummary(ix, user, sessions, sl.progression)).filter(p => p.history.length > 0),
  })).filter(g => g.tiles.length > 0)
}

/* ── Fokus-Modus ─────────────────────────────────────────────────────────── */

/** nächste noch nicht erfasste Satznummer (1 … planned), sonst null */
export function nextSetNo(s: { sets: SetLog[]; planned: number }): number | null {
  for (let n = 1; n <= s.planned; n++) if (!s.sets.some(x => x.set === n)) return n
  return null
}

/** Was nach der Pause dran ist: weiterer Satz derselben Übung, sonst die erste offene Übung */
export function upNext(slots: SlotView[], current: ProgressionId | undefined): { slot: SlotView; setNo: number } | null {
  const cur = slots.find(s => s.pid === current)
  const n = cur && cur.state === 'open' ? nextSetNo(cur) : null
  if (cur && n) return { slot: cur, setNo: n }
  const next = slots.find(s => s.state === 'open' && nextSetNo(s))
  return next ? { slot: next, setNo: nextSetNo(next)! } : null
}

/* ── Startseite „Heute“ ──────────────────────────────────────────────────── */

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00`); d.setDate(d.getDate() + n); return localDate(d)
}
/** Montag der Woche, in der `date` liegt */
export const weekStart = (date: string) => addDays(date, -((new Date(`${date}T12:00`).getDay() + 6) % 7))

export interface WeekDay { date: string; label: string; trained: boolean; cardio: boolean; today: boolean; planned: boolean }
/** die laufende Woche Mo–So: trainiert, Cardio, heute, laut Wochenplan vorgesehen */
export function weekStrip(ix: Index, sessions: Session[], activities: Activity[], today: string): WeekDay[] {
  const marks = calendarMarks(sessions, activities), mon = weekStart(today)
  return WEEK_ORDER.map((wd, i) => {
    const date = addDays(mon, i)
    return { date, label: WEEKDAY_SHORT[wd], trained: marks.trained.has(date), cardio: marks.cardio.has(date),
      today: date === today, planned: !!ix.catalog.weekplan[wd] }
  })
}

/** Wochen in Serie mit mindestens einer Einheit; die laufende Woche zählt mit, bricht die Serie aber nicht */
export function streakWeeks(sessions: Session[], today: string, phases: Phase[] = []): number {
  const weeks = new Set(sessions.filter(isTrained).map(s => weekStart(s.date)))
  // Wochen in einer Pause oder im Urlaub unterbrechen die Serie nicht (zählen aber nicht mit)
  const resting = (w: string) => phases.some(p => (p.kind === 'pause' || p.kind === 'vacation') && p.from <= addDays(w, 6) && (!p.to || p.to >= w))
  let w = weekStart(today), n = 0
  if (!weeks.has(w)) w = addDays(w, -7)
  for (let guard = 0; guard < 520 && (weeks.has(w) || resting(w)); guard++) { if (weeks.has(w)) n++; w = addDays(w, -7) }
  return n
}

/** typische Dauer eines Workouts in Minuten (Median der letzten fünf mit Dauer), sonst null */
export function estimateMinutes(sessions: Session[], workout: WorkoutId): number | null {
  const d = sessions.filter(s => s.workout === workout && (s.durationSec ?? 0) > 600)
    .sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5).map(s => s.durationSec!).sort((a, b) => a - b)
  return d.length ? Math.round(d[Math.floor(d.length / 2)] / 60 / 5) * 5 : null
}

/** Wie nah die nächste Stufe ist (0–1): Anteil der Freischalt-Schwelle über die letzten zwei vollständigen
    Einheiten, fehlende Einheiten zählen als 0. null = Stufe schaltet nie automatisch frei. */
export function unlockReadiness(sessions: Session[], exercise: ExerciseId, target: Target, next?: Target): number | null {
  if (target.unlockAt == null) return null
  const complete = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(s => setsOf(s, exercise)).filter(sets => sets.length >= target.sets).slice(-2)
  const share = (sets: SetLog[]) => sets.slice(0, target.sets).reduce((n, x) => n + (meetsUnlock(x, target, next) ? 1 : Math.min(1, x.value / target.unlockAt!)), 0) / target.sets
  return (complete.reduce((n, sets) => n + share(sets), 0)) / 2
}

/** Skills mit dem kürzesten Weg zur nächsten Stufe – Skill-Block zuerst */
export function nextSkills(ix: Index, user: UserState, sessions: Session[], n = 2) {
  const seen = new Set<ProgressionId>()
  return ix.catalog.workouts.flatMap(w => w.slots).filter(sl => !seen.has(sl.progression) && seen.add(sl.progression))
    .filter(sl => !user.paused.includes(sl.progression))
    .map(sl => {
      const step = currentStep(ix, user, sl.progression)
      return { pid: sl.progression, skill: sl.block === 'skill', step, readiness: step.next ? unlockReadiness(sessions, step.exercise.id, step.target, step.nextTarget) : null }
    })
    .filter((p): p is typeof p & { readiness: number } => p.readiness !== null)
    .sort((a, b) => Number(b.skill) - Number(a.skill) || b.readiness - a.readiness).slice(0, n)
}

/* ── Abschluss ───────────────────────────────────────────────────────────── */

export interface SessionSummary {
  durationSec: number
  sets: number
  reps: number                      // Summe der Wiederholungen (Halteübungen nicht mitgezählt)
  repsDelta: number | null          // zur letzten Einheit desselben Workouts
  records: { exercise: Exercise; kind: 'reps' | 'weight'; value: number; before: number }[]
  compare: { exercise: Exercise; before: number; now: number }[]
}

/** Zusammenfassung einer Einheit: Kennzahlen, neue Bestwerte gegenüber allen früheren Einheiten,
    Vergleich je Übung mit deren letzter Einheit */
export function sessionSummary(ix: Index, sessions: Session[], s: Session): SessionSummary {
  const earlier = sessions.filter(x => x.date < s.date)
  const repsOf = (x: Session) => x.sets.reduce((n, set) => n + (ix.exercises.get(set.exercise)?.unit === 'reps' ? set.value : 0), 0)
  const prev = earlier.filter(x => x.workout === s.workout && x.sets.length).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const rows = sessionExercises(ix, s)
  const records: SessionSummary['records'] = []
  const compare: SessionSummary['compare'] = []
  for (const { exercise, sets } of rows) {
    const before = earlier.flatMap(x => setsOf(x, exercise.id))
    if (before.length) {
      const best = Math.max(...sets.map(x => x.value)), bestBefore = Math.max(...before.map(x => x.value))
      if (best > bestBefore) records.push({ exercise, kind: 'reps', value: best, before: bestBefore })
      const kg = Math.max(0, ...sets.map(x => x.weightKg ?? 0)), kgBefore = Math.max(0, ...before.map(x => x.weightKg ?? 0))
      if (kg > kgBefore) records.push({ exercise, kind: 'weight', value: kg, before: kgBefore })
    }
    const last = lastPerformance(sessions, exercise.id, s.date)
    if (last) compare.push({ exercise, before: last.sets.reduce((n, x) => n + x.value, 0), now: sets.reduce((n, x) => n + x.value, 0) })
  }
  return { durationSec: s.durationSec ?? 0, sets: s.sets.length, reps: repsOf(s), repsDelta: prev ? repsOf(s) - repsOf(prev) : null, records, compare }
}

/* ── Skill-Tree ──────────────────────────────────────────────────────────── */

/** Stand zur Freischaltung: wie viele der nötigen 2 Einheiten am Stück geschafft sind
    und wie viele Sätze in der letzten vollständigen Einheit noch unter der Schwelle lagen */
export function unlockProgress(sessions: Session[], exercise: ExerciseId, target: Target, next?: Target) {
  if (target.unlockAt == null) return null
  const complete = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(s => setsOf(s, exercise)).filter(sets => sets.length >= target.sets)
  const ok = (sets: SetLog[]) => sets.slice(0, target.sets).every(x => meetsUnlock(x, target, next))
  const last = complete.at(-1), prev = complete.at(-2)
  const done = last && ok(last) ? (prev && ok(prev) ? 2 : 1) : 0
  const missing = last ? last.slice(0, target.sets).filter(x => !meetsUnlock(x, target, next)).length : target.sets
  return { done, needed: 2, missing, sessions: complete.length }
}

/** Für die aktuelle Stufe: beste Einheit (größte Summe) und in Worten, was zum Freischalten fehlt */
export function stepStanding(sessions: Session[], exercise: Exercise, target: Target, next?: Target): { best: string | null; missing: string | null } {
  const unit = exercise.unit === 'seconds' ? ' s' : t('logic.unitReps')
  const all = sessions.map(s => setsOf(s, exercise.id)).filter(x => x.length)
  const best = all.length ? all.reduce((a, b) => (sum(b) > sum(a) ? b : a)) : null
  const p = unlockProgress(sessions, exercise.id, target, next)
  let missing: string | null = null
  if (p && target.unlockAt != null && p.done < 2) {
    missing = p.sessions === 0 ? t('logic.standingNone')
      : p.missing > 0 ? tn('logic.standingSets', p.missing, { target: `${target.unlockAt}${unit}` })
      : t('logic.standingOneMore')
  }
  return { best: best ? best.map(x => `${x.value}${x.weightKg ? `+${fmtNum(x.weightKg)}` : ''}`).join('·') : null, missing }
}
const sum = (sets: SetLog[]) => sets.reduce((n, x) => n + x.value, 0)

export interface SkillNode { exercise: Exercise; target: Target; state: 'done' | 'current' | 'locked'; sessions: number }
export interface SkillPath { pid: ProgressionId
  /** Workout im Plan, in dem die Progression vorkommt – fehlt, wenn sie (noch) in keinem steht */
  workout?: Workout; region?: Region; block: string; step: Step; nodes: SkillNode[]; paused: boolean
  progress: ReturnType<typeof unlockProgress>; readiness: number | null }

/** alle Progressionen: erst die aus dem Plan (Wochen- und Trainingsreihenfolge), dann die übrigen aus dem Katalog */
export function skillTree(ix: Index, user: UserState, sessions: Session[]): SkillPath[] {
  const count = (id: ExerciseId) => sessions.filter(s => s.sets.some(x => x.exercise === id)).length
  const seen = new Set<ProgressionId>()
  const inPlan = workoutsInWeekOrder(ix).flatMap(w => w.slots.filter(sl => !seen.has(sl.progression) && seen.add(sl.progression))
    .map(sl => ({ pid: sl.progression, block: sl.block as string, workout: w as Workout | undefined })))
  const rest = [...ix.progressions.keys()].filter(pid => !seen.has(pid)).map(pid => ({ pid, block: 'skill', workout: undefined }))
  return [...inPlan, ...rest].filter(x => ix.progressions.get(x.pid)?.steps.length).map(({ pid, block, workout }) => {
    const step = currentStep(ix, user, pid)
    const p = ix.progressions.get(pid)!
    return {
      pid, workout, region: p.region, block, step, paused: user.paused.includes(pid),
      nodes: p.steps.map((st, i) => ({
        exercise: ix.exercises.get(st.exercise)!, target: st.target, sessions: count(st.exercise),
        state: i < step.index ? 'done' as const : i === step.index ? 'current' as const : 'locked' as const,
      })),
      progress: step.next ? unlockProgress(sessions, step.exercise.id, step.target, step.nextTarget) : null,
      readiness: step.next ? unlockReadiness(sessions, step.exercise.id, step.target, step.nextTarget) : null,
    }
  })
}

/** Monatsbilanz für den Kalender: Einheiten, Trainingszeit, Sätze, Cardio-Einheiten */
export function monthStats(sessions: Session[], activities: Activity[], month: string) {
  const s = sessions.filter(x => x.date.startsWith(month) && isTrained(x))
  return {
    sessions: s.length,
    durationSec: s.reduce((n, x) => n + (x.durationSec ?? 0), 0),
    sets: s.reduce((n, x) => n + x.sets.length, 0),
    cardio: cardioOnly(activities).filter(a => a.date.startsWith(month)).length,
  }
}

/* ── Profil, Ziele, Skill-Vorschläge ─────────────────────────────────────── */

export const EQUIPMENT_LABEL: Record<Exclude<Equipment, 'floor' | 'wall'>, string> =
  labels(['bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'pole'] as const, k => `logic.equipment.${k}`)
/** Profil, solange keins gespeichert ist: keine Ziele, alle Geräte, Tage aus dem Wochenplan */
export function profileOf(ix: Index, user: UserState): Profile {
  return user.profile ?? {
    goals: [], equipment: Object.keys(EQUIPMENT_LABEL) as Equipment[],
    days: WEEK_ORDER.filter(d => ix.catalog.weekplan[d]), minutes: 75,
  }
}
/** aktuelle Stufe als Index je Leiter (Eingabe für Vorschläge und Generator) */
export const stepIndexes = (ix: Index, user: UserState): Record<ProgressionId, number> =>
  Object.fromEntries([...ix.progressions.keys()].map(pid => [pid, currentStep(ix, user, pid).index]))

/** Skills, deren Leitern der Katalog kennt – mit Bewertung „realistisch als Nächstes“ */
export function skillChoices(ix: Index, user: UserState, skills: Skill[], meta?: Record<string, ExerciseMeta>): SkillSuggestion[] {
  const known = skills.filter(s => [...s.targets, ...s.prerequisites.map(p => p.progression)].every(pid => ix.progressions.has(pid)))
  return suggestSkills(known, ix.catalog, stepIndexes(ix, user), meta ?? ix.catalog.meta)
}
/** Fortschritt zu einem Ziel: Stufen der Ziel-Leitern (plus Bereitschaft zur nächsten), 0–1 */
export function goalProgress(ix: Index, user: UserState, sessions: Session[], skill: Skill) {
  const parts = skill.targets.filter(pid => ix.progressions.has(pid)).map(pid => {
    const step = currentStep(ix, user, pid)
    const ready = step.next ? unlockReadiness(sessions, step.exercise.id, step.target, step.nextTarget) ?? 0 : 0
    return { pid, step, share: step.total > 1 ? Math.min(1, (step.index + ready) / (step.total - 1)) : 1 }
  })
  const share = parts.length ? parts.reduce((n, p) => n + p.share, 0) / parts.length : 0
  const lead = parts.reduce((a, b) => (b.share < a.share ? b : a), parts[0])
  return { share, pid: lead?.pid, current: lead?.step.exercise.name ?? '', stage: lead ? t('logic.stage', { i: lead.step.index + 1, n: lead.step.total }) : '' }
}
export { MAX_GOALS }

/** Konkrete Begründung zu einem Skill-Vorschlag: was fehlt, wo man steht oder womit man anfängt –
    statt nur einer Einstufung („realistisch“) */
export function goalReason(ix: Index, user: UserState, skills: Skill[], c: SkillSuggestion): string {
  if (c.reached) return t('skills.reached')
  if (c.missing.length) return t('skills.reason.missing', { list: c.missing.join(', ') })
  const after = c.after && skills.find(s => s.id === c.after)?.name
  if (after) return t('skills.reason.after', { name: after })
  const skill = skills.find(s => s.id === c.skill)
  const steps = (skill?.targets ?? []).filter(pid => ix.progressions.has(pid)).map(pid => currentStep(ix, user, pid))
  const started = steps.find(s => s.index > 0)
  if (started) return t('skills.reason.started', { name: started.exercise.name, stage: t('logic.stage', { i: started.index + 1, n: started.total }) })
  return steps[0] ? t('skills.reason.start', { name: steps[0].exercise.name }) : t(`profile.goals.tier.${c.tier}`)
}

export interface GoalIdea { skill: SkillId; name: string; tier: SkillSuggestion['tier']; reason: string }
/** Zielvorschläge: die realistischsten Skills, ohne gewählte Ziele, Erreichtes und Skills, die ein
    Ziel ohnehin mittrainiert (Klimmzüge mit Gewicht stecken im Muscle-up) */
export function goalIdeas(ix: Index, user: UserState, skills: Skill[], meta?: Record<string, ExerciseMeta>, n = 3): GoalIdea[] {
  const goals = profileOf(ix, user).goals
  const order = { next: 0, work: 1, long: 2 }
  return skillChoices(ix, user, skills, meta)
    .filter(c => !c.reached && !goals.includes(c.skill) && !c.partOf.some(g => goals.includes(g)))
    .sort((a, b) => order[a.tier] - order[b.tier] || b.score - a.score)
    .slice(0, n)
    .map(c => ({ skill: c.skill, name: c.name, tier: c.tier, reason: goalReason(ix, user, skills, c) }))
}
/** Ziel an/aus (höchstens MAX_GOALS, das älteste fällt raus) */
export function withGoal(p: Profile, skill: SkillId, on: boolean): Profile {
  const goals = on ? [...new Set([...p.goals, skill])].slice(-MAX_GOALS) : p.goals.filter(g => g !== skill)
  return { ...p, goals }
}

/* ── Planvorschläge (Generator → Diff → Bestätigung) ─────────────────────── */

/** Eingabe für den Generator aus Profil und Stand; ohne Ziele kein Vorschlag */
export function generatorInput(ix: Index, user: UserState, skills: Skill[], splits: SplitTemplate[]): GeneratorInput | null {
  const p = profileOf(ix, user)
  if (!p.goals.length || !p.days.length) return null
  const regions = [...new Set(p.goals.flatMap(g => skills.find(s => s.id === g)?.targets ?? [])
    .map(pid => ix.progressions.get(pid)?.region).filter((r): r is Region => !!r))]
  return {
    skills: p.goals, equipment: [...new Set([...p.equipment, 'floor', 'wall'])] as Equipment[], days: p.days, minutes: p.minutes,
    current: stepIndexes(ix, user),
    // Leitern des aktuellen Plans (Wochenplan) – der Generator behält sie nach Möglichkeit
    keep: [...new Set(Object.values(ix.catalog.weekplan).flatMap(id => (id ? ix.workouts.get(id)?.slots.map(s => s.progression) ?? [] : [])))],
    // gewählte Vorlage, solange sie zur Zahl der Tage passt – sonst die naheliegendste
    split: splits.find(t => t.id === p.split && t.themes.length === p.days.length)?.id ?? suggestSplits(splits, p.days.length, regions)[0]?.id,
  }
}

/** Wochenvorschau einer Split-Vorlage: welcher Trainingstag (Mo zuerst) welches Thema bekommt –
    dieselbe Zuordnung wie der Generator (assignThemes, Gewicht = Schwierigkeit der aktuellen Stufe
    der Ziel-Leitern). Passt die Vorlage nicht zur Zahl der Tage: leer. */
export function splitWeek(ix: Index, user: UserState, skills: Skill[], split: SplitTemplate, meta?: Record<string, ExerciseMeta>):
  { day: Weekday; theme: SplitTemplate['themes'][number] }[] {
  const p = profileOf(ix, user)
  const rest = restDays(p.days)
  const days = [...rest.keys()]
  if (!days.length || split.themes.length !== days.length) return []
  const m = meta ?? ix.catalog.meta ?? {}
  const weights = [...new Set(p.goals.flatMap(g => skills.find(s => s.id === g)?.targets ?? []))].flatMap(pid => {
    const prog = ix.progressions.get(pid)
    if (!prog) return []
    const step = currentStep(ix, user, pid)
    return [{ region: (prog.region ?? 'core') as Region, weight: m[step.exercise.id]?.difficulty ?? 3 }]
  })
  const themeOf = assignThemes(split.themes, days, rest, weights)
  return days.map(day => ({ day, theme: themeOf.get(day)! }))
}

/** Erzeugten Plan in einen Nutzerplan übersetzen. Keys `auto-<tag>` bleiben über Vorschläge hinweg
    stabil; Warm-up/Cool-down vom Katalog-Workout mit den meisten gemeinsamen Körperregionen.
    Bisherige Workouts bleiben erhalten (eigene aktiv, andere als gelöscht markiert – Verlauf). */
export function planFromGenerated(ix: Index, base: Plan, g: GeneratedPlan, input: GeneratorInput): Plan {
  const regionsOf = (pids: ProgressionId[]) => new Set(pids.map(pid => ix.progressions.get(pid)?.region).filter(Boolean))
  const names = new Map<string, number>()
  const workouts: Workout[] = g.days.map(d => {
    const slots = d.slots.map(s => ({ block: s.block, progression: s.progression, sets: s.sets, reason: s.reason }))
    const mine = regionsOf(slots.map(s => s.progression))
    const like = [...ix.workouts.values()].filter(w => !w.custom && w.warmup.length)
      .map(w => ({ w, n: [...regionsOf(w.slots.map(s => s.progression))].filter(r => mine.has(r)).length }))
      .sort((a, b) => b.n - a.n)[0]?.w
    const theme = d.theme ?? t('logic.fullBody')
    const n = (names.get(theme) ?? 0) + 1; names.set(theme, n)
    return {
      id: `auto-${d.day}`, name: g.days.filter(x => (x.theme ?? t('logic.fullBody')) === theme).length > 1 ? `${theme} ${String.fromCharCode(64 + n)}` : theme,
      focus: focusOf(ix, slots), slots, warmup: like ? structuredClone(like.warmup) : [], cooldown: like ? structuredClone(like.cooldown) : [],
    }
  })
  const fresh = new Set(workouts.map(w => w.id))
  const kept = base.workouts.filter(w => !fresh.has(w.id)).map(w => (w.custom ? w : { ...w, archived: true }))
  return {
    ...base, source: 'generated', workouts: [...workouts, ...kept],
    weekplan: Object.fromEntries(g.days.map(d => [d.day, `auto-${d.day}`])),
    inputs: { skills: input.skills, equipment: input.equipment, days: input.days, minutes: input.minutes, split: input.split },
  }
}

/** Gleicher Plan? (Wochentage → Leitern in Reihenfolge, Satzzahlen) – dann kein Vorschlag */
export function samePlan(ix: Index, next: Plan): boolean {
  const sig = (wp: Partial<Record<Weekday, WorkoutId>>, get: (id: WorkoutId) => Workout | undefined) =>
    WEEK_ORDER.map(d => (wp[d] ? (get(wp[d]!)?.slots ?? []).map(s => `${s.progression}:${s.sets ?? ''}`).join(',') : '-')).join('|')
  return sig(ix.catalog.weekplan, id => ix.workouts.get(id)) === sig(next.weekplan, id => next.workouts.find(w => w.id === id))
}

export interface DayDiff {
  day: Weekday; before?: string; after?: string
  changes: { name: string; kind: 'neu' | 'raus' | 'sätze' | 'bleibt'; detail?: string }[]
}
/** Unterschied je Wochentag: welche Leitern kommen dazu, fallen weg, ändern die Satzzahl */
export function planDiff(ix: Index, user: UserState, next: Plan): DayDiff[] {
  const name = (pid: ProgressionId) => (ix.progressions.has(pid) ? currentStep(ix, user, pid).exercise.name : pid)
  return WEEK_ORDER.flatMap(day => {
    const a = ix.catalog.weekplan[day] ? ix.workouts.get(ix.catalog.weekplan[day]!) : undefined
    const b = next.weekplan[day] ? next.workouts.find(w => w.id === next.weekplan[day]) : undefined
    if (!a && !b) return []
    const setsOf = (w: Workout | undefined, pid: ProgressionId) => {
      const sl = w?.slots.find(s => s.progression === pid)
      return sl ? sl.sets ?? (ix.progressions.has(pid) ? slotStep(ix, user, sl).target.sets : 0) : 0
    }
    const changes: DayDiff['changes'] = []
    for (const sl of b?.slots ?? []) {
      const before = setsOf(a, sl.progression), after = setsOf(b, sl.progression)
      changes.push(!before ? { name: name(sl.progression), kind: 'neu', detail: sl.reason }
        : before !== after ? { name: name(sl.progression), kind: 'sätze', detail: t('logic.setsChange', { before, after }) }
        : { name: name(sl.progression), kind: 'bleibt' })
    }
    for (const sl of a?.slots ?? []) if (!b?.slots.some(x => x.progression === sl.progression)) changes.push({ name: name(sl.progression), kind: 'raus' })
    return [{ day, before: a?.name, after: b?.name, changes }]
  })
}

/* ── Phasen: Pause/krank, Urlaub, Verletzung, Equipment ──────────────────── */

export const PHASE_LABEL: Record<PhaseKind, string> = labels(['pause', 'vacation', 'injury', 'equipment'] as const, k => `logic.phase.${k}`)
export const TENDON_LABEL: Record<Tendon, string> = labels(TENDONS, k => `logic.tendon.${k}`)
export const MUSCLE_LABEL: Record<MuscleArea, string> = labels(MUSCLE_AREAS, k => `logic.muscle.${k}`)
export const AREA_LABEL: Record<BodyArea, string> = { ...TENDON_LABEL, ...MUSCLE_LABEL }
const isTendon = (a: BodyArea): a is Tendon => (TENDONS as string[]).includes(a)

/** Muskelbereiche einer Übung – abgeleitet aus Bewegungsmuster und Übung (fachlich grob, reicht zum
    Sperren bei einer Zerrung): Zug = oberer Rücken + Oberarm, Druck = Oberarm (+ Brust bei Dips und
    Liegestütz-Mustern), Rumpf = Bauch, Kniebeuge/Hüftstreckung = Oberschenkel. */
export function musclesOf(exercise: ExerciseId, meta: ExerciseMeta): MuscleArea[] {
  const has = (...xs: string[]) => xs.some(x => exercise.includes(x))
  const out = new Set<MuscleArea>()
  switch (meta.pattern) {
    case 'vertical-pull': out.add('upperBack').add('arms'); if (has('muscle-up', 'ring-transition')) out.add('chest'); break
    case 'horizontal-pull': out.add('upperBack').add('arms'); if (has('lever')) out.add('abs'); break
    case 'vertical-push': out.add('arms'); if (has('dip')) out.add('chest'); break
    case 'horizontal-push': out.add('chest').add('arms'); if (has('planche')) out.add('abs'); break
    case 'squat': out.add('thigh'); if (has('pistol', 'shrimp')) out.add('calf'); break
    case 'hinge': out.add('thigh'); break
    case 'core':
      out.add('abs')
      if (has('l-sit', 'v-sit', 'manna', 'elbow-lever', 'crow')) out.add('arms')
      if (has('flag', 'side-lever') && !has('dragon')) out.add('upperBack').add('arms')
      break
    case 'conditioning':
      out.add('thigh').add('abs')
      if (has('burpee', 'squat-thrust', 'bear-crawl', 'mountain', 'inchworm')) out.add('arms').add('chest')
      break
    case 'isolation':
      if (has('curl', 'triceps')) out.add('arms')
      if (has('fly')) out.add('chest')
      if (has('calf', 'tibialis')) out.add('calf')
      if (has('hang', 'skin-the-cat', 'scapula', 'dislocate', 'external-rotation', 'face-pull')) out.add('upperBack')
      if (has('wrist')) out.add('arms')
      break
  }
  return [...out]
}
/** ab dieser Sehnenbelastung (0–3) ruht eine Übung bei Verletzung – jede Belastung des Gelenks */
const INJURY_STRESS = 1

export const activePhases = (user: UserState, date: string) => (user.phases ?? []).filter(p => p.from <= date && (!p.to || p.to >= date))
/** Pause oder Urlaub heute? – dann ist nichts fällig */
export const restingPhase = (user: UserState, date: string) => activePhases(user, date).find(p => p.kind === 'pause' || p.kind === 'vacation')

/** Warum eine Übung heute ruht (Verletzung, fehlendes Gerät) – sonst null */
export function phaseBlock(phases: Phase[], meta: ExerciseMeta | undefined, exercise?: ExerciseId): string | null {
  if (!meta) return null
  for (const p of phases) {
    if (p.kind === 'injury') {
      const muscles = exercise ? musclesOf(exercise, meta) : []
      const hit = (p.tendons ?? []).filter(a => (isTendon(a) ? (meta.stress[a] ?? 0) >= INJURY_STRESS : muscles.includes(a)))
      if (hit.length) return t('logic.injuredBy', { joints: hit.map(x => AREA_LABEL[x]).join(', ') })
    }
    if (p.kind === 'equipment' && !usable(meta, p.equipment ?? [])) return t('logic.noEquipment')
  }
  return null
}

/** Wiedereinstieg: in der Woche nach einer Pause je Übung ein Satz weniger (mindestens zwei) */
export function reentry(user: UserState, date: string): boolean {
  return (user.phases ?? []).some(p => (p.kind === 'pause' || p.kind === 'vacation') && p.to && p.to < date && date <= addDays(p.to, 7))
}

/** neue Phase ab `from`; days = Länge in Tagen, null = bis auf Weiteres */
export function newPhase(kind: PhaseKind, from: string, days: number | null, extra: Pick<Phase, 'tendons' | 'equipment'> = {}): Phase {
  return { id: `${from}-${kind}`, kind, from, ...(days ? { to: addDays(from, days - 1) } : {}), ...extra }
}
/** Phase einfügen (gleiche id ersetzt) */
export const withPhase = (user: UserState, p: Phase): UserState =>
  ({ ...user, phases: [...(user.phases ?? []).filter(x => x.id !== p.id), p] })
/** Phase beenden: endet gestern; hat sie heute erst begonnen, fällt sie weg */
export function withPhaseEnded(user: UserState, id: string, today: string): UserState {
  const phases = (user.phases ?? []).flatMap(p => p.id !== id ? [p] : p.from >= today ? [] : [{ ...p, to: addDays(today, -1) }])
  return { ...user, phases }
}
export const fmtPhase = (p: Phase) => `${PHASE_LABEL[p.kind]}${p.kind === 'injury' && p.tendons?.length ? ` · ${p.tendons.map(t => AREA_LABEL[t]).join(', ')}` : ''}`
  + (p.to ? t('logic.phaseUntil', { date: fmtShortDate(p.to) }) : t('logic.phaseOpen'))

/* ── Einstufung (Kurztest) ───────────────────────────────────────────────── */

export interface PlacementChange { pid: ProgressionId; ladder: string; from: number; to: number; total: number; fromName: string; toName: string }
/** Was der Kurztest höher einstufen würde – nie zurück (Freischaltungen bleiben verdient) */
export function placementChanges(ix: Index, user: UserState, placed: Record<ProgressionId, number>): PlacementChange[] {
  return Object.entries(placed).flatMap(([pid, to]) => {
    const p = ix.progressions.get(pid)
    if (!p) return []
    const step = currentStep(ix, user, pid)
    if (to <= step.index) return []
    const name = (i: number) => ix.exercises.get(p.steps[i].exercise)?.name ?? ''
    return [{ pid, ladder: progressionName(ix, pid), from: step.index, to, total: p.steps.length, fromName: step.exercise.name, toName: name(to) }]
  })
}
/** „Kann ich schon“: alle Ziel-Leitern eines Skills auf ihre letzte Stufe setzen (rückgängig über
    die Leiter, eine Stufe zurück) – erspart das Freischalten Stufe für Stufe */
export function withSkillReached(ix: Index, user: UserState, skill: Skill): UserState {
  const current = { ...user.current }
  for (const pid of skill.targets) {
    const steps = ix.progressions.get(pid)?.steps
    if (steps?.length) current[pid] = steps[steps.length - 1].exercise
  }
  return { ...user, current }
}
/** Stufen, die vorne in bestehende Leitern eingefügt wurden (Katalog-Ausbau 14.10.2026): wer schon
    trainiert und dort keine Stufe gewählt hat, stand bisher auf der alten ersten Stufe – dabei bleibt es */
export const STEP_PINS: Record<ProgressionId, ExerciseId> = {
  'l-sit': 'l-sit-floor', handstand: 'handstand-wall', 'muscle-up-transition': 'muscle-up-band',
  'planche-advanced': 'adv-tuck-planche', scapula: 'scapula-shrug',
  'pull-up': 'pull-up', dip: 'dip', 'horizontal-push': 'decline-push-up', 'split-squat': 'bulgarian-split-squat',
  'one-arm-pull-up': 'one-arm-negative', row: 'body-row',
  'hip-hinge': 'single-leg-glute-bridge', calf: 'calf-raise-single-leg',
}
export const needsStepPins = (user: UserState) => Object.keys(STEP_PINS).some(pid => !user.current[pid])
export function withStepPins(user: UserState): UserState {
  const add = Object.fromEntries(Object.entries(STEP_PINS).filter(([pid]) => !user.current[pid]))
  return Object.keys(add).length ? { ...user, current: { ...add, ...user.current } } : user
}
/** Einstufung übernehmen: aktuelle Stufe je Leiter setzen */
export function withPlacement(ix: Index, user: UserState, changes: PlacementChange[]): UserState {
  const current = { ...user.current }
  for (const c of changes) { const ex = ix.progressions.get(c.pid)?.steps[c.to]?.exercise; if (ex) current[c.pid] = ex }
  return { ...user, current }
}

/* ── Vorlagen (Bibliothek) ───────────────────────────────────────────────── */

/** Plan-Vorlage → Nutzerplan. Workouts bekommen Keys `<vorlage>-<workout>`; passt die Zahl der
    Profil-Trainingstage, liegen die Workouts auf deinen Tagen (in Wochenreihenfolge), sonst auf
    denen der Vorlage. Bisherige Workouts bleiben (eigene aktiv, andere als gelöscht – Verlauf). */
export function planFromTemplate(ix: Index, base: Plan, tpl: Template, days: Weekday[] = []): Plan {
  const key = (id: WorkoutId) => `${tpl.id}-${id}`.slice(0, 80)
  const known = new Set(ix.progressions.keys())
  const workouts = tpl.workouts.map(w => ({ ...structuredClone(w), id: key(w.id), slots: w.slots.filter(s => known.has(s.progression)) }))
  const tplDays = WEEK_ORDER.filter(d => tpl.weekplan?.[d])
  const mine = WEEK_ORDER.filter(d => days.includes(d))
  const target = mine.length === tplDays.length ? mine : tplDays
  const weekplan = Object.fromEntries(tplDays.map((d, i) => [target[i], key(tpl.weekplan![d]!)])) as Plan['weekplan']
  const fresh = new Set(workouts.map(w => w.id))
  const kept = base.workouts.filter(w => !fresh.has(w.id)).map(w => (w.custom ? w : { ...w, archived: true }))
  return { ...base, source: 'catalog', name: tpl.name, workouts: [...workouts, ...kept], weekplan }
}
/** Workout-Vorlage → eigenes Workout (eigener Key, ohne Wochentag) */
export function workoutFromTemplate(ix: Index, tpl: Template): Workout {
  const w = tpl.workouts[0]
  const known = new Set(ix.progressions.keys())
  return { ...structuredClone(w), id: workoutKey(tpl.name, ix.workouts.keys()), name: tpl.name, slots: w.slots.filter(s => known.has(s.progression)), custom: true }
}
export const LEVEL_LABEL: Record<Template['level'], string> = labels(['beginner', 'intermediate', 'advanced'] as const, k => `logic.level.${k}`)

/* ── Skills-Übersicht ────────────────────────────────────────────────────── */

export interface SkillCard {
  skill: Skill; share: number; stage: string; current: string; lead?: ProgressionId
  region?: Region; goal: boolean; started: boolean; reached: boolean; missing: string[]; score: number
}
/** Alle Skills mit Fortschritt – Ziele zuerst, dann begonnene (nach Fortschritt), dann die
    realistischsten, erreichte am Ende */
export function skillOverview(ix: Index, user: UserState, sessions: Session[], skills: Skill[], meta?: Record<string, ExerciseMeta>): SkillCard[] {
  const goals = profileOf(ix, user).goals
  const choice = new Map(skillChoices(ix, user, skills, meta).map(c => [c.skill, c]))
  const cards = skills.filter(s => choice.has(s.id)).map((skill): SkillCard => {
    const p = goalProgress(ix, user, sessions, skill)
    const c = choice.get(skill.id)!
    const touched = skill.targets.some(pid => ix.progressions.has(pid) && (currentStep(ix, user, pid).index > 0
      || sessions.some(s => s.sets.some(x => ix.progressions.get(pid)!.steps.some(st => st.exercise === x.exercise)))))
    return { skill, share: p.share, stage: p.stage, current: p.current, lead: p.pid, region: ix.progressions.get(skill.targets[0])?.region,
      goal: goals.includes(skill.id), started: touched, reached: c.reached, missing: c.missing, score: c.score }
  })
  const rank = (c: SkillCard) => (c.goal ? 0 : c.reached ? 3 : c.started ? 1 : 2)
  return cards.sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? b.share - a.share : b.score - a.score))
}

/* ── Runden-Blöcke (z. B. Cindy) ─────────────────────────────────────────── */

export const circuitsOf = (w: Workout | undefined): Circuit[] => w?.circuits ?? []
/** neue ID aus dem Namen + Zeitstempel (stabil nach dem Anlegen) */
export const newCircuitId = (name: string): CircuitId =>
  `c-${name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'runden'}-${Date.now().toString(36)}`
/** Block anlegen oder ersetzen (Reihenfolge bleibt), Werte in sinnvolle Grenzen */
export function withCircuit(w: Workout, c: Circuit): Workout {
  const clean: Circuit = {
    id: c.id, name: c.name.trim().slice(0, 80) || t('logic.circuit.defaultName'), mode: c.mode,
    ...(c.mode === 'amrap' ? { minutes: Math.min(120, Math.max(1, Math.round(c.minutes ?? 10))) } : { rounds: Math.min(100, Math.max(1, Math.round(c.rounds ?? 3))) }),
    items: c.items.slice(0, 12).map(x => ({ exercise: x.exercise, reps: Math.min(1000, Math.max(1, Math.round(x.reps))) })),
  }
  const list = circuitsOf(w)
  return { ...w, circuits: list.some(x => x.id === c.id) ? list.map(x => (x.id === c.id ? clean : x)) : [...list, clean] }
}
export const withoutCircuit = (w: Workout, id: CircuitId): Workout => ({ ...w, circuits: circuitsOf(w).filter(x => x.id !== id) })
/** „AMRAP 20 min“ bzw. „5 Runden auf Zeit“ */
export const fmtCircuitRule = (c: Circuit) => c.mode === 'amrap' ? t('logic.circuit.amrap', { min: c.minutes ?? 0 }) : t('logic.circuit.forTime', { n: c.rounds ?? 0 })
/** „5 Klimmzüge · 10 Liegestütze · 15 Kniebeugen“ (Halteübungen in Sekunden) */
export const fmtCircuitItems = (ix: Index, c: Circuit) => c.items.map(x => {
  const e = ix.exercises.get(x.exercise)
  return e?.unit === 'seconds' ? `${x.reps} s ${e.name}` : `${x.reps} ${e?.name ?? x.exercise}`
}).join(' · ')
export const circuitResultOf = (s: Session | undefined, id: CircuitId): CircuitResult | undefined => s?.circuits?.find(r => r.id === id)
export const withCircuitResult = (s: Session, r: CircuitResult): Session =>
  ({ ...s, circuits: [...(s.circuits ?? []).filter(x => x.id !== r.id), r] })
/** „14 Runden + 7“ bzw. Zeit „12:30“ */
export const fmtCircuitResult = (c: Pick<Circuit, 'mode'>, r: CircuitResult) => c.mode === 'rounds'
  ? fmtClock(Math.round(r.durationSec ?? 0))
  : r.reps ? t('logic.circuit.roundsPlus', { n: r.rounds, reps: r.reps }) : tn('logic.circuit.roundsN', r.rounds)
/** besser als vorher? AMRAP: mehr Runden/Wdh.; feste Runden: schneller */
export function circuitBetter(c: Pick<Circuit, 'mode'>, a: CircuitResult, b: CircuitResult): boolean {
  if (c.mode === 'rounds') return (a.durationSec ?? Infinity) < (b.durationSec ?? Infinity)
  return a.rounds > b.rounds || (a.rounds === b.rounds && (a.reps ?? 0) > (b.reps ?? 0))
}
/** letztes Ergebnis desselben Blocks vor `before` (für „Zuletzt“) */
export function lastCircuitResult(sessions: Session[], id: CircuitId, before: string): { date: string; r: CircuitResult } | null {
  const hit = sessions.filter(s => s.date < before && !s.deleted).map(s => ({ date: s.date, r: circuitResultOf(s, id) }))
    .filter((x): x is { date: string; r: CircuitResult } => !!x.r).sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  return hit ?? null
}
/** gesamte Wiederholungen je Übung eines Ergebnisses (AMRAP: volle Runden + angefangene Runde) */
export function circuitVolume(c: Circuit, r: CircuitResult): { exercise: ExerciseId; reps: number }[] {
  let rest = r.reps ?? 0
  return c.items.map(x => {
    const partial = Math.min(rest, x.reps); rest -= partial
    return { exercise: x.exercise, reps: x.reps * r.rounds + (c.mode === 'amrap' ? partial : 0) }
  })
}
/** Runden-Ergebnisse einer Einheit zum Anzeigen (Name, Ergebnis, Übungen) – auch wenn der Block
    inzwischen gelöscht ist (dann Standardname, Art aus dem Ergebnis) */
export function sessionCircuits(ix: Index, s: Session) {
  const defs = circuitsOf(ix.workouts.get(s.workout))
  return (s.circuits ?? []).map(r => {
    const c = defs.find(x => x.id === r.id)
    const mode = c?.mode ?? (r.durationSec !== undefined ? 'rounds' : 'amrap')
    // angezeigt wird die Regel („AMRAP 20 min“) – Runden-Blöcke haben keinen eigenen Namen
    return { id: r.id, name: c ? fmtCircuitRule(c) : t('logic.circuit.defaultName'), result: fmtCircuitResult({ mode }, r), items: c ? fmtCircuitItems(ix, c) : '' }
  })
}
