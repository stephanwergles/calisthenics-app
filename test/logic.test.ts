/* node --test test/logic.test.ts – Trainingslogik der v2-App gegen den echten Katalog */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Session, UserState } from '../src/domain/model.ts'
import * as L from '../src/client/logic.ts'

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/seed/catalog.json', import.meta.url), 'utf8'))
const ix = L.indexCatalog(catalog)
const state: UserState = { current: { 'muscle-up-pull': 'chest-to-bar-pull-up' }, paused: [] }
const sess = (date: string, workout: string, sets: [string, number[]][]): Session => ({
  ...L.emptySession(date, workout),
  sets: sets.flatMap(([exercise, vals]) => vals.map((value, i) => ({ exercise, progression: 'x', set: i + 1, value }))),
})

test('lokales Datum statt UTC', () => {
  assert.equal(L.localDate(new Date(2026, 9, 1, 0, 30)), '2026-10-01')
  assert.equal(L.weekdayOf('2026-10-04'), 'sun')
})

test('aktuelle Stufe: aus dem Stand, sonst erste Stufe', () => {
  const s = L.currentStep(ix, state, 'muscle-up-pull')
  assert.equal(s.exercise.id, 'chest-to-bar-pull-up')
  assert.equal(s.index, 1)
  assert.equal(s.prev!.id, 'explosive-pull-up')
  assert.equal(s.next!.id, 'muscle-up')
  assert.equal(L.currentStep(ix, state, 'pistol').exercise.id, 'pistol-squat-assisted')
  assert.equal(L.currentStep(ix, { current: { pistol: 'gibt-es-nicht' }, paused: [] }, 'pistol').index, 0)
})

test('Empfehlung: Wochenplan, an freien Tagen die längste Pause', () => {
  assert.equal(L.recommendWorkout(ix, [], '2026-10-04'), 'pull')   // Sonntag
  assert.equal(L.recommendWorkout(ix, [], '2026-10-05'), 'legs')   // Montag
  const hist = [sess('2026-09-28', 'push', [['dip', [12]]]), sess('2026-09-30', 'pull', [['pull-up', [5]]]), sess('2026-09-14', 'legs', [['dead-hang', [60]]])]
  assert.equal(L.recommendWorkout(ix, hist, '2026-10-02'), 'legs')  // Freitag
  assert.deepEqual(L.workoutsInWeekOrder(ix).map(w => w.id), ['legs', 'push', 'pull'])
})

test('Historie folgt der Übung, nicht dem Slot', () => {
  const hist = [sess('2026-09-21', 'pull', [['pull-up', [6, 5, 4, 3]]]), sess('2026-09-30', 'pull', [['pull-up', [5, 5, 5, 4]]])]
  assert.deepEqual(L.lastPerformance(hist, 'pull-up', '2026-10-04')!.sets.map(s => s.value), [5, 5, 5, 4])
  assert.equal(L.lastPerformance(hist, 'pull-up', '2026-09-30')!.date, '2026-09-21')
  assert.equal(L.lastPerformance(hist, 'dip', '2026-10-04'), null)
})

test('Freischaltung: zwei vollständige Einheiten, jeder Satz am Ziel', () => {
  const t = { label: '4 × 6–8', sets: 4, min: 6, max: 8, restSec: 120, unlockAt: 8 }
  const a = sess('2026-09-01', 'pull', [['straight-bar-dip', [8, 8, 8, 8]]])
  const b = sess('2026-09-08', 'pull', [['straight-bar-dip', [8, 9, 8, 10]]])
  const short = sess('2026-09-15', 'pull', [['straight-bar-dip', [8, 8]]])
  assert.equal(L.readyToProgress([a, b], 'straight-bar-dip', t), true)
  assert.equal(L.readyToProgress([a, b, short], 'straight-bar-dip', t), true, 'unvollständige zählt nicht')
  assert.equal(L.readyToProgress([a, sess('2026-09-08', 'pull', [['straight-bar-dip', [8, 7, 8, 8]]])], 'straight-bar-dip', t), false)
  assert.equal(L.readyToProgress([a, b], 'straight-bar-dip', { ...t, unlockAt: null }), false)
})

test('Einheit bearbeiten: Satz ersetzen, löschen, überspringen, Plan', () => {
  let s = L.emptySession('2026-10-04', 'pull')
  s = L.withSkip(s, 'pull-up', true)
  s = L.withSet(s, { exercise: 'pull-up', progression: 'pull-up', set: 1, value: 5 })
  assert.deepEqual(s.skipped, [], 'ein Satz hebt das Überspringen auf')
  s = L.withSet(s, { exercise: 'pull-up', progression: 'pull-up', set: 1, value: 6 })
  assert.equal(L.setsOf(s, 'pull-up').length, 1)
  assert.equal(L.setsOf(s, 'pull-up')[0].value, 6)
  s = L.withPlan(s, 'pull-up', 1)
  assert.equal(L.slotState(s, 'pull-up', L.plannedSets(s, 'pull-up', { sets: 4 } as never), false), 'done')
  s = L.withoutSet(s, 'pull-up', 1)
  assert.equal(L.slotState(s, 'pull-up', 1, false), 'open')
  assert.equal(L.slotState(s, 'pull-up', 1, true), 'paused')
  assert.equal(L.withDuration(L.withDuration(s, 100), 50.4).durationSec, 150)
  assert.ok(s.updatedAt)
})

test('Vorbelegung des Satz-Editors', () => {
  const ex = ix.exercises.get('pull-up')!, t = { label: '', sets: 4, min: 6, max: 8, restSec: 180, unlockAt: 8 }
  const set = (n: number, v: number, w?: number) => ({ exercise: 'pull-up', progression: 'pull-up', set: n, value: v, weightKg: w })
  assert.deepEqual(L.prefill([], [], 1, t, ex), { value: 8, weightKg: 0 })
  assert.deepEqual(L.prefill([], [set(1, 5, 5)], 1, t, ex), { value: 5, weightKg: 5 })
  assert.deepEqual(L.prefill([set(1, 6)], [set(3, 4)], 2, t, ex), { value: 6, weightKg: 0 }, 'vorheriger Satz heute')
  assert.equal(L.prefill([], [], 1, { ...t, max: undefined, unlockAt: null }, ix.exercises.get('dead-hang')!).value, 10)
})

test('Formatierung', () => {
  assert.equal(L.fmtClock(90), '1:30')
  assert.equal(L.fmtDuration(4189), '1:09:49')
  assert.equal(L.fmtSet({ exercise: 'pull-up', progression: '', set: 1, value: 5, weightKg: 5 }, ix.exercises.get('pull-up')!), '5 +5 kg')
})

test('Workout-Ansicht: Reihenfolge, Status, Historie, Freischaltung', () => {
  const user: UserState = { current: {}, paused: ['one-arm-pull'] }
  const hist = [
    sess('2026-09-21', 'pull', [['straight-bar-dip', [14, 14, 10, 8]]]),
    sess('2026-09-30', 'pull', [['straight-bar-dip', [14, 14, 12, 10]], ['pull-up', [5, 5, 5, 4]]]),
  ]
  let today = L.emptySession('2026-10-04', 'pull')
  today = L.withSkip(today, 'body-row', true)
  today = L.withSet(today, { exercise: 'explosive-pull-up', progression: 'muscle-up-pull', set: 1, value: 3 })
  const v = L.workoutSlots(ix, 'pull', user, today, [...hist, today], '2026-10-04')
  assert.deepEqual(v.map(x => x.pid), ['muscle-up-pull', 'bar-dip', 'muscle-up-transition', 'pull-up', 'one-arm-pull', 'row', 'scapula', 'biceps'])
  const by = Object.fromEntries(v.map(x => [x.pid, x]))
  assert.equal(by['muscle-up-pull'].state, 'open')
  assert.equal(by['muscle-up-pull'].sets.length, 1)
  assert.equal(by['row'].state, 'skipped')
  assert.equal(by['one-arm-pull'].state, 'paused')
  assert.equal(by['one-arm-pull'].ready, false)
  assert.equal(by['bar-dip'].ready, true, 'Straight Bar Dips: zweimal alle Sätze ≥ 8')
  assert.equal(by['pull-up'].last!.date, '2026-09-30')
  assert.equal(L.firstOpen(v.map(x => ({ pid: x.pid, state: x.state }))), 'muscle-up-pull')
})

test('Kalender: Monatsraster ab Montag, Monatswechsel über Jahresgrenzen', () => {
  const g = L.monthGrid('2026-10')          // 1. Oktober 2026 ist ein Donnerstag
  assert.equal(g.lead, 3)
  assert.equal(g.days.length, 31)
  assert.equal(g.days[0], '2026-10-01')
  assert.equal(L.monthGrid('2026-02').days.length, 28)
  assert.equal(L.shiftMonth('2026-12', 1), '2027-01')
  assert.equal(L.shiftMonth('2026-01', -1), '2025-12')
})

test('Kalender: trainiert = Satz oder Dauer, leere Einheiten zählen nicht', () => {
  const marks = L.calendarMarks([
    sess('2026-10-01', 'pull', [['bar-dip', [5]]]),
    { ...L.emptySession('2026-10-02', 'push'), durationSec: 600 },
    L.emptySession('2026-10-03', 'legs'),
  ], [{ id: 'a', date: '2026-10-05', kind: 'run', durationMin: 20 }])
  assert.deepEqual([...marks.trained], ['2026-10-01', '2026-10-02'])
  assert.deepEqual([...marks.cardio], ['2026-10-05'])
})

test('Tagesansicht: Übungen in Trainingsreihenfolge, Unbekanntes fällt weg', () => {
  const s = sess('2026-10-04', 'pull', [['scapula-shrug', [10]], ['explosive-pull-up', [3, 3]], ['gibt-es-nicht', [1]]])
  assert.deepEqual(L.sessionExercises(ix, s).map(e => [e.exercise.id, e.sets.length]),
    [['explosive-pull-up', 2], ['scapula-shrug', 1]])
})

test('Fortschritt: Verlauf über alle Stufen, Delta nur innerhalb der aktuellen Stufe', () => {
  const sessions = [
    sess('2026-09-01', 'pull', [['explosive-pull-up', [3, 3, 3]]]),
    sess('2026-09-08', 'pull', [['chest-to-bar-pull-up', [2, 2, 1]]]),
    sess('2026-09-15', 'pull', [['chest-to-bar-pull-up', [3, 2, 2]]]),
  ]
  const p = L.progressSummary(ix, state, sessions, 'muscle-up-pull')
  assert.deepEqual(p.history.map(h => [h.step, h.sum]), [[0, 9], [1, 5], [1, 7]])
  assert.equal(p.current.length, 2)
  assert.equal(p.delta, 2)
  assert.equal(p.best, 3)
  // neue Stufe ohne Einheit: Historie bleibt sichtbar, aber kein Delta
  const fresh = L.progressSummary(ix, { current: { 'muscle-up-pull': 'muscle-up' }, paused: [] }, sessions, 'muscle-up-pull')
  assert.equal(fresh.history.length, 3)
  assert.equal(fresh.last, undefined)
  assert.equal(fresh.delta, null)
  // Übersicht: nur Progressionen mit Historie, Workouts in Wochenreihenfolge
  const ov = L.progressOverview(ix, state, sessions)
  assert.deepEqual(ov.map(g => [g.workout.id, g.tiles.map(t => t.pid)]), [['pull', ['muscle-up-pull']]])
})

test('Aktivitäten: Anzeige', () => {
  assert.equal(L.fmtActivity({ id: 'a', date: '2026-10-01', kind: 'ride', durationMin: 90, distanceKm: 40.5, elevationM: 450 }), '90 min · 40,5 km · 450 hm')
  assert.equal(L.activityTitle({ id: 'b', date: '2026-10-01', kind: 'workout', name: 'Cindy' }), 'Cindy')
})

test('Notizen: zur Einheit und pro Satz', () => {
  const s = L.emptySession('2026-10-12', 'legs')
  const n = L.withNote(s, '  Knie links zwickt  ')
  assert.equal(n.note, 'Knie links zwickt')
  assert.ok(n.updatedAt)
  assert.equal('note' in L.withNote(n, '   '), false, 'leere Notiz entfernt das Feld')
  assert.equal(L.withNote(s, 'x'.repeat(600)).note!.length, L.NOTE_MAX)
  const sets = [
    { exercise: 'dip', progression: 'dip', set: 2, value: 8, note: 'Schulter' },
    { exercise: 'dip', progression: 'dip', set: 1, value: 10 },
    { exercise: 'dip', progression: 'dip', set: 3, value: 6, note: 'knapp' },
  ]
  assert.deepEqual(L.notesOf(sets), [{ set: 2, note: 'Schulter' }, { set: 3, note: 'knapp' }])
})

test('Fokus: nächster Satz und was nach der Pause kommt', () => {
  assert.equal(L.nextSetNo({ sets: [], planned: 3 }), 1)
  assert.equal(L.nextSetNo({ sets: [{ exercise: 'x', progression: 'x', set: 1, value: 5 }, { exercise: 'x', progression: 'x', set: 3, value: 5 }], planned: 3 }), 2)
  assert.equal(L.nextSetNo({ sets: [1, 2].map(set => ({ exercise: 'x', progression: 'x', set, value: 5 })), planned: 2 }), null)

  const today = sess('2026-10-12', 'legs', [['pistol-squat-assisted', [6, 6, 6, 6]], ['bulgarian-split-squat', [8]]])
  const slots = L.workoutSlots(ix, 'legs', { current: {}, paused: [] }, today, [today], '2026-10-12')
  const after = L.upNext(slots, 'split-squat')
  assert.equal(after?.slot.pid, 'split-squat')
  assert.equal(after?.setNo, 2, 'gleiche Übung, nächster Satz')
  const fromDone = L.upNext(slots, 'pistol')
  assert.equal(fromDone?.slot.pid, 'split-squat', 'erledigte Übung → erste offene')
  const skipped = { ...today, skipped: ['bulgarian-split-squat'] }
  const s2 = L.workoutSlots(ix, 'legs', { current: {}, paused: [] }, skipped, [skipped], '2026-10-12')
  assert.equal(L.upNext(s2, 'pistol')?.slot.pid, 'nordic', 'übersprungene fallen weg')
})

test('Heute: Wochenleiste, Serie, Dauer, Bereitschaft', () => {
  const sessions = [
    { ...sess('2026-09-28', 'legs', [['pistol-squat-assisted', [6]]]), durationSec: 4500 },
    { ...sess('2026-10-05', 'legs', [['pistol-squat-assisted', [6]]]), durationSec: 4800 },
    { ...sess('2026-10-12', 'legs', [['pistol-squat-assisted', [6]]]), durationSec: 3900 },
  ]
  const week = L.weekStrip(ix, sessions, [{ id: 'a', date: '2026-10-14', kind: 'run' }], '2026-10-13')
  assert.deepEqual(week.map(d => d.label), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
  assert.equal(week[0].date, '2026-10-12')
  assert.ok(week[0].trained && week[1].today && week[2].cardio && week[2].planned && !week[1].planned)
  assert.equal(L.streakWeeks(sessions, '2026-10-13'), 3)
  assert.equal(L.streakWeeks(sessions.slice(0, 2), '2026-10-13'), 2, 'laufende Woche ohne Training bricht nicht')
  assert.equal(L.streakWeeks(sessions.slice(0, 1), '2026-10-13'), 0, 'eine Woche Lücke bricht')
  assert.equal(L.estimateMinutes(sessions, 'legs'), 75)
  assert.equal(L.estimateMinutes(sessions, 'push'), null)

  const target = ix.progressions.get('muscle-up-pull')!.steps[1].target   // Chest-to-Bar, 5 × 3, Schwelle 5
  const cb = (d: string, v: number[]) => sess(d, 'pull', [['chest-to-bar-pull-up', v]])
  assert.equal(L.unlockReadiness([], 'chest-to-bar-pull-up', target), 0)
  assert.equal(L.unlockReadiness([cb('2026-10-01', [5, 5, 5, 5, 5]), cb('2026-10-04', [5, 5, 5, 5, 5])], 'chest-to-bar-pull-up', target), 1)
  assert.ok(Math.abs(L.unlockReadiness([cb('2026-10-04', [5, 5, 5, 5, 5])], 'chest-to-bar-pull-up', target)! - 0.5) < 1e-9)
  const skills = L.nextSkills(ix, state, [cb('2026-10-04', [5, 5, 5, 5, 5])])
  assert.equal(skills[0].pid, 'muscle-up-pull', 'Skill mit dem meisten Fortschritt zuerst')
})

test('Abschluss: Kennzahlen, Bestwerte, Vergleich', () => {
  const before = sess('2026-09-30', 'pull', [['straight-bar-dip', [12, 12, 10]], ['pull-up', [5, 5, 5]]])
  const now = { ...sess('2026-10-07', 'pull', [['straight-bar-dip', [14, 12, 12]], ['pull-up', [5, 5, 4]]]), durationSec: 6300 }
  now.sets = now.sets.map(x => (x.exercise === 'pull-up' ? { ...x, weightKg: 5 } : x))
  const sum = L.sessionSummary(ix, [before, now], now)
  assert.equal(sum.sets, 6)
  assert.equal(sum.reps, 52)
  assert.equal(sum.repsDelta, 3)
  assert.deepEqual(sum.records.map(r => [r.exercise.id, r.kind, r.value, r.before]), [['straight-bar-dip', 'reps', 14, 12], ['pull-up', 'weight', 5, 0]])
  assert.deepEqual(sum.compare.map(c => [c.exercise.id, c.before, c.now]), [['straight-bar-dip', 34, 38], ['pull-up', 15, 14]])
  assert.deepEqual(L.sessionSummary(ix, [now], now).records, [], 'ohne Vorgeschichte keine Bestwerte')
})

test('Skill-Tree: Leitern, Stand zur Freischaltung', () => {
  const target = ix.progressions.get('muscle-up-pull')!.steps[1].target
  const cb = (d: string, v: number[]) => sess(d, 'pull', [['chest-to-bar-pull-up', v]])
  assert.deepEqual(L.unlockProgress([], 'chest-to-bar-pull-up', target), { done: 0, needed: 2, missing: 5, sessions: 0 })
  assert.deepEqual(L.unlockProgress([cb('2026-10-01', [3, 3, 3, 3, 3]), cb('2026-10-04', [5, 5, 5, 5, 5])], 'chest-to-bar-pull-up', target),
    { done: 1, needed: 2, missing: 0, sessions: 2 })
  assert.equal(L.unlockProgress([cb('2026-10-01', [5, 5, 5, 5, 5]), cb('2026-10-04', [5, 5, 5, 5, 4])], 'chest-to-bar-pull-up', target)!.missing, 1)

  const tree = L.skillTree(ix, state, [cb('2026-10-04', [5, 5, 5, 5, 5])])
  assert.equal(tree.length, 24)
  assert.equal(tree[0].workout.id, 'legs', 'Wochenreihenfolge: Mo zuerst')
  const mu = tree.find(p => p.pid === 'muscle-up-pull')!
  assert.deepEqual(mu.nodes.map(n => n.state), ['done', 'current', 'locked'])
  assert.equal(mu.nodes[1].sessions, 1)
  assert.equal(mu.progress?.done, 1)
})

test('Kalender: Monatsbilanz', () => {
  const ss = [
    { ...sess('2026-10-04', 'pull', [['pull-up', [5, 5]]]), durationSec: 3600 },
    { ...sess('2026-10-07', 'push', [['dip', [8]]]), durationSec: 1800 },
    sess('2026-09-30', 'pull', [['pull-up', [5]]]),
    L.emptySession('2026-10-09', 'legs'),
  ]
  assert.deepEqual(L.monthStats(ss, [{ id: 'a', date: '2026-10-05', kind: 'run' }, { id: 'b', date: '2026-09-02', kind: 'ride' }], '2026-10'),
    { sessions: 2, durationSec: 5400, sets: 3, cardio: 1 })
})
