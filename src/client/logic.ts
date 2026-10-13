/* Trainingslogik der v2-App – rein funktional, ohne React, DOM oder Speicher.
   Die Oberfläche ruft diese Funktionen auf; getestet wird direkt mit node --test. */
import type {
  Activity, Catalog, Equipment, Exercise, ExerciseId, Plan, Profile, Progression, ProgressionId, Region, Session, SetLog,
  Skill, SkillId, Target, UserState, Weekday, Workout, WorkoutId, GeneratedPlan, GeneratorInput, SplitTemplate, Phase, PhaseKind, Tendon, ExerciseMeta, Template,
} from '../domain/model.ts'
import { usable } from '../domain/generator.ts'
import { suggestSkills, suggestSplits, type SkillSuggestion } from '../domain/assessment.ts'
import { NOTE_MAX, REGIONS } from '../domain/model.ts'
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

const trained = (s: Session) => s.sets.length > 0 || s.durationSec !== undefined

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

export const hasActivity = (activities: Activity[], date: string) => activities.some(a => a.date === date)

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
  `${x.value}${ex.unit === 'seconds' ? ' s' : ''}${x.weightKg ? ` +${x.weightKg} kg` : ''}`
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
}

/** Alles, was die Ansicht pro Slot braucht – in Trainingsreihenfolge */
export function workoutSlots(ix: Index, workout: WorkoutId, user: UserState, today: Session | undefined, sessions: Session[], date: string,
  opts: { meta?: Record<ExerciseId, ExerciseMeta> } = {}): SlotView[] {
  const phases = activePhases(user, date)
  const lighter = reentry(user, date)
  const view = (sl: DaySlot, substituteFor?: string): SlotView => {
    const step = currentStep(ix, user, sl.progression)
    const blockedBy = opts.meta ? phaseBlock(phases, opts.meta[step.exercise.id]) ?? undefined : undefined
    const paused = user.paused.includes(sl.progression) || !!blockedBy
    const base = plannedSets(undefined, sl.progression, step.target, sl.sets)
    const planned = today?.setPlan?.[sl.progression] ?? (lighter ? Math.max(2, base - 1) : base)
    return {
      pid: sl.progression, block: sl.block, step, planned, added: sl.added, blockedBy, substituteFor,
      sets: setsOf(today, step.exercise.id),
      state: slotState(today, step.exercise.id, planned, paused),
      last: lastPerformance(sessions, step.exercise.id, date),
      ready: !paused && !!step.next && readyToProgress(sessions, step.exercise.id, step.target, step.nextTarget),
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
    .map(p => ({ p, m: meta[currentStep(ix, user, p.id).exercise.id] }))
    .filter(x => x.m && x.m.pattern === m.pattern && (x.p.region === region || m.pattern !== 'isolation') && !phaseBlock(phases, x.m))
    .sort((a, b) => Number(b.p.region === region) - Number(a.p.region === region) || Math.abs(a.m.difficulty - m.difficulty) - Math.abs(b.m.difficulty - m.difficulty))[0]?.p.id ?? null
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

const ACTIVITY_LABEL = labels(['run', 'ride', 'workout'] as const, k => `logic.activity.${k}`)
export const activityTitle = (a: Activity) => a.name || ACTIVITY_LABEL[a.kind]
export const fmtActivity = (a: Activity) => [
  a.durationMin ? `${a.durationMin} min` : null,
  a.distanceKm ? `${fmtNum(a.distanceKm)} km` : null,
  a.elevationM ? t('logic.elevation', { n: a.elevationM }) : null,
  a.rounds ? t('logic.rounds', { n: a.rounds }) : null,
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
    cardio: activities.filter(a => a.date.startsWith(month)).length,
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
export function skillChoices(ix: Index, user: UserState, skills: Skill[]): SkillSuggestion[] {
  const known = skills.filter(s => [...s.targets, ...s.prerequisites.map(p => p.progression)].every(pid => ix.progressions.has(pid)))
  return suggestSkills(known, ix.catalog, stepIndexes(ix, user))
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
/** Ziel an/aus (höchstens drei) */
export function withGoal(p: Profile, skill: SkillId, on: boolean): Profile {
  const goals = on ? [...new Set([...p.goals, skill])].slice(-3) : p.goals.filter(g => g !== skill)
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
    // gewählte Vorlage, solange sie zur Zahl der Tage passt – sonst die naheliegendste
    split: splits.find(t => t.id === p.split && t.themes.length === p.days.length)?.id ?? suggestSplits(splits, p.days.length, regions)[0]?.id,
  }
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
      return sl ? sl.sets ?? (ix.progressions.has(pid) ? currentStep(ix, user, pid).target.sets : 0) : 0
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
export const TENDON_LABEL: Record<Tendon, string> = labels(['shoulder', 'elbow', 'wrist', 'knee'] as const, k => `logic.tendon.${k}`)
/** ab dieser Sehnenbelastung (0–3) ruht eine Übung bei Verletzung – jede Belastung des Gelenks */
const INJURY_STRESS = 1

export const activePhases = (user: UserState, date: string) => (user.phases ?? []).filter(p => p.from <= date && (!p.to || p.to >= date))
/** Pause oder Urlaub heute? – dann ist nichts fällig */
export const restingPhase = (user: UserState, date: string) => activePhases(user, date).find(p => p.kind === 'pause' || p.kind === 'vacation')

/** Warum eine Übung heute ruht (Verletzung, fehlendes Gerät) – sonst null */
export function phaseBlock(phases: Phase[], meta: ExerciseMeta | undefined): string | null {
  if (!meta) return null
  for (const p of phases) {
    if (p.kind === 'injury') {
      const hit = (p.tendons ?? []).filter(t => (meta.stress[t] ?? 0) >= INJURY_STRESS)
      if (hit.length) return t('logic.injuredBy', { joints: hit.map(x => TENDON_LABEL[x]).join(', ') })
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
export const fmtPhase = (p: Phase) => `${PHASE_LABEL[p.kind]}${p.kind === 'injury' && p.tendons?.length ? ` · ${p.tendons.map(t => TENDON_LABEL[t]).join(', ')}` : ''}`
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
