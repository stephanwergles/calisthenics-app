/* node --test test/logic.test.ts – Trainingslogik der v2-App gegen den echten Katalog */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Session, UserState } from '../src/domain/model.ts'
import * as L from '../src/core/logic.ts'

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
  const user = L.withStepPins({ current: {}, paused: ['one-arm-pull'] }) // bestehender Nutzer
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
  const slots = L.workoutSlots(ix, 'legs', L.withStepPins({ current: {}, paused: [] }), today, [today], '2026-10-12')
  const after = L.upNext(slots, 'split-squat')
  assert.equal(after?.slot.pid, 'split-squat')
  assert.equal(after?.setNo, 2, 'gleiche Übung, nächster Satz')
  const fromDone = L.upNext(slots, 'pistol')
  assert.equal(fromDone?.slot.pid, 'split-squat', 'erledigte Übung → erste offene')
  const skipped = { ...today, skipped: ['bulgarian-split-squat'] }
  const s2 = L.workoutSlots(ix, 'legs', L.withStepPins({ current: {}, paused: [] }), skipped, [skipped], '2026-10-12')
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
  assert.equal(tree.length, catalog.progressions.length, 'alle Progressionen, auch die nicht im Plan')
  assert.equal(tree[0].workout!.id, 'legs', 'Wochenreihenfolge: Mo zuerst')
  assert.equal(tree.filter(p => !p.workout).length, catalog.progressions.length - 24, 'neue Progressionen hinten, ohne Workout')
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

test('Einheit löschen: leere Markierung, Neubeginn startet leer', () => {
  const s: Session = { ...L.emptySession('2026-10-12', 'legs'), sets: [{ exercise: 'pistol-squat', progression: 'pistol', set: 1, value: 5 }], note: 'x', durationSec: 600 }
  const d = L.deletedSession(s)
  assert.equal(d.deleted, true)
  assert.equal(d.id, s.id)
  assert.deepEqual([d.sets, d.note, d.durationSec], [[], undefined, undefined])
  assert.ok((d.updatedAt ?? 0) > 0, 'Änderung → wird synchronisiert')
  assert.equal(L.live(d), undefined)
  assert.equal(L.live(s), s)
})

test('Stand der aktuellen Stufe: beste Einheit und was fehlt', () => {
  const ex = { id: 'c2b', name: 'Chest-to-Bar', unit: 'reps' } as never
  const target = { sets: 5, unlockAt: 5, label: '5 × 3–5' } as never
  const sess = (date: string, values: number[]): Session => ({ ...L.emptySession(date, 'pull'),
    sets: values.map((value, i) => ({ exercise: 'c2b', progression: 'mu', set: i + 1, value })) })
  assert.deepEqual(L.stepStanding([], ex, target), { best: null, missing: 'noch keine vollständige Einheit auf dieser Stufe' })
  const a = sess('2026-10-01', [3, 3, 3, 3, 4]), b = sess('2026-10-05', [5, 5, 5, 5, 4])
  assert.deepEqual(L.stepStanding([a, b], ex, target), { best: '5·5·5·5·4', missing: 'fehlt noch: 1 Satz mit 5 Wdh.' })
  const c = sess('2026-10-08', [5, 5, 5, 5, 5])
  assert.equal(L.stepStanding([a, b, c], ex, target).missing, 'fehlt noch: 1 weitere Einheit, alle Sätze geschafft')
  assert.equal(L.stepStanding([a, c, sess('2026-10-10', [6, 5, 5, 5, 5])], ex, target).missing, null)
})

test('Freischalten: Sätze mit Zusatzgewicht zählen ab dem Mindestwert der nächsten Stufe', () => {
  const target = { label: '4 × 8–12', sets: 4, min: 8, max: 12, restSec: 120, unlockAt: 12 }
  const next = { label: '4 × 6–10', sets: 4, min: 6, max: 10, restSec: 150, unlockAt: 10 }
  const sess = (date: string, value: number, weightKg?: number): Session => ({ ...L.emptySession(date, 'push'),
    sets: [1, 2, 3, 4].map(set => ({ exercise: 'dip', progression: 'dip', set, value, ...(weightKg ? { weightKg } : {}) })) })
  const weighted = [sess('2026-10-01', 8, 10), sess('2026-10-05', 7, 10)]
  assert.equal(L.readyToProgress(weighted, 'dip', target), false, 'ohne nächste Stufe zählt nur unlockAt')
  assert.equal(L.readyToProgress(weighted, 'dip', target, next), true, '8 und 7 mit +10 kg ≥ 6 → frei')
  assert.equal(L.readyToProgress([sess('2026-10-01', 5, 10), sess('2026-10-05', 8, 10)], 'dip', target, next), false, '5 mit Gewicht reicht nicht')
  assert.equal(L.readyToProgress([sess('2026-10-01', 8), sess('2026-10-05', 8)], 'dip', target, next), false, 'ohne Gewicht weiter 12 nötig')
  assert.equal(L.unlockProgress(weighted, 'dip', target, next)!.done, 2)
  assert.equal(L.unlockReadiness(weighted, 'dip', target, next), 1)
})

test('Eigener Plan: ohne Plan gilt der Katalog ohne Wochentage, mit Plan dessen Workouts und Wochenplan', () => {
  assert.deepEqual(L.effectiveCatalog(catalog, null).workouts, catalog.workouts, 'ohne Plan die Katalog-Workouts')
  assert.deepEqual(L.effectiveCatalog(catalog, null).weekplan, {}, 'ohne Plan keine Tage (der Katalog-Rhythmus gehört niemandem)')
  const plan = L.planFromCatalog(catalog)
  assert.deepEqual(L.effectiveCatalog(catalog, plan).workouts, catalog.workouts, 'Kopie des Katalogs = gleicher Plan')
  assert.deepEqual(plan.weekplan, {}, 'Kopie ohne Tage')
  const days = L.planForDays(catalog, ['fri', 'mon', 'wed', 'sat'])
  const ids = catalog.workouts.filter(w => !w.archived).map(w => w.id)
  assert.deepEqual(days.weekplan, { mon: ids[0], wed: ids[1 % ids.length], fri: ids[2 % ids.length], sat: ids[3 % ids.length] }, 'Workouts der Reihe nach auf die Tage')
  plan.workouts[0].name = 'geändert'
  assert.notEqual(catalog.workouts[0].name, 'geändert', 'Kopie, keine Referenz')
  const own = { ...plan, workouts: [{ ...plan.workouts[0], id: 'mein-tag', slots: [...plan.workouts[0].slots, { block: 'strength' as const, progression: 'gibt-es-nicht' }] }], weekplan: { thu: 'mein-tag' } }
  const eff = L.effectiveCatalog(catalog, own)
  assert.deepEqual(eff.workouts.map(w => w.id), ['mein-tag'])
  assert.equal(eff.workouts[0].slots.length, plan.workouts[0].slots.length, 'unbekannte Leiter fällt weg')
  assert.equal(L.indexCatalog(eff).workouts.get('mein-tag')?.id, 'mein-tag')
  assert.equal(eff.progressions, catalog.progressions, 'Leitern bleiben aus dem Katalog')
})

test('Tagesanpassung: weglassen, hinzufügen, als Workout speichern', () => {
  const legs = ix.workouts.get('legs')!
  const [first, second] = legs.slots.map(s => s.progression)
  const extra = catalog.progressions.find(p => !legs.slots.some(s => s.progression === p.id))!.id
  let s = L.emptySession('2026-10-14', 'legs')
  assert.equal(L.isAdjusted(s), false)
  s = L.withRemoved(s, first, true)
  s = L.withAdded(s, extra)
  s = L.withPlan(s, extra, 2)
  assert.equal(L.isAdjusted(s), true)
  const day = L.daySlots(ix, 'legs', s)
  assert.equal(day.some(x => x.progression === first), false, 'weggelassen')
  assert.deepEqual(day.at(-1), { block: 'extra', progression: extra, added: true }, 'hinten angehängt')
  const view = L.workoutSlots(ix, 'legs', { current: {}, paused: [] }, s, [s], '2026-10-14')
  assert.equal(view.at(-1)!.added, true)
  assert.equal(view.at(-1)!.planned, 2)
  // zurückholen / hinzugefügte wieder raus → keine Anpassung mehr
  const back = L.withRemoved(L.withRemoved(s, first, false), extra, true)
  assert.equal(L.isAdjusted(back), false)
  assert.equal('added' in back || 'removed' in back, false, 'leere Listen fallen weg')
  // als neues Workout: Übungsliste und Satzzahl des Tages, Warm-up übernommen
  const w = L.workoutFromDay(ix, 'legs', s, 'Beine kurz')
  assert.equal(w.id, 'beine-kurz')
  assert.equal(w.custom, true)
  assert.equal(w.slots[0].progression, second)
  assert.deepEqual(w.slots.at(-1), { block: 'strength', progression: extra, sets: 2 })
  assert.deepEqual(w.warmup, legs.warmup)
  assert.equal(L.workoutKey('Beine kurz', ['beine-kurz']), 'beine-kurz-2')
  assert.equal(L.workoutKey('Übungen für Größe!', []), 'uebungen-fuer-groesse')
  assert.equal(L.workoutKey('???', []), 'workout')
})

test('Eigener Plan bearbeiten: Workout, Slots, Wochentage, Löschen', () => {
  let plan = L.planFromCatalog(catalog)
  const w = L.newWorkout(ix, 'Mein Tag', [])
  assert.equal(w.focus, 'Eigenes Workout')
  plan = L.withWorkout(plan, w)
  let ixp = L.indexCatalog(L.effectiveCatalog(catalog, plan))
  let mine = L.withSlot(ixp, ixp.workouts.get('mein-tag')!, 'pull-up')
  mine = L.withSlot(ixp, mine, 'pistol')
  mine = L.withSlot(ixp, mine, 'pull-up')
  assert.deepEqual(mine.slots.map(s => s.progression), ['pull-up', 'pistol'], 'keine Doppelten')
  assert.equal(mine.focus, 'Ziehen · Beine', 'Fokus aus den Regionen')
  mine = L.movedSlot(ixp, mine, 'pistol', -1)
  assert.deepEqual(mine.slots.map(s => s.progression), ['pistol', 'pull-up'])
  assert.equal(L.movedSlot(ixp, mine, 'pistol', -1), mine, 'am Rand unverändert')
  mine = L.withSlotSets(ixp, mine, 'pull-up', 12)
  assert.equal(mine.slots[1].sets, 10, 'höchstens 10 Sätze')
  plan = L.withDay(L.withWorkout(plan, mine), 'thu', 'mein-tag')
  ixp = L.indexCatalog(L.effectiveCatalog(catalog, plan))
  assert.deepEqual(L.plannedDays(ixp, 'mein-tag'), ['thu'])
  assert.equal(L.recommendWorkout(ixp, [], '2026-10-15'), 'mein-tag')   // Donnerstag
  const view = L.workoutSlots(ixp, 'mein-tag', { current: {}, paused: [] }, undefined, [], '2026-10-15')
  assert.equal(view[1].planned, 10, 'Satzzahl aus dem Workout')
  // Löschen: bleibt markiert (Verlauf), fällt aus Auswahl und Wochenplan
  plan = L.withoutWorkout(plan, 'mein-tag')
  ixp = L.indexCatalog(L.effectiveCatalog(catalog, plan))
  assert.equal(ixp.workouts.get('mein-tag')!.archived, true)
  assert.equal(L.workoutsInWeekOrder(ixp).some(x => x.id === 'mein-tag'), false)
  assert.equal(ixp.catalog.weekplan.thu, undefined)
  assert.notEqual(L.recommendWorkout(ixp, [], '2026-10-15'), 'mein-tag')
  plan = L.withDay(plan, 'sun', undefined)
  assert.equal(plan.weekplan.sun, undefined)
  const groups = L.ladderChoices(ix, { current: {}, paused: [] }, ['pull-up'])
  assert.equal(groups.flatMap(g => g.items).some(x => x.pid === 'pull-up'), false)
  assert.deepEqual(groups.map(g => g.label).slice(0, 2), ['Ziehen', 'Drücken'])
})

test('Profil und Ziele: Standardwerte, höchstens fünf Ziele, Vorschläge, Fortschritt', () => {
  const skills = JSON.parse(readFileSync(new URL('../src/seed/skills.json', import.meta.url), 'utf8')).skills
  const p = L.profileOf(ix, state)
  assert.deepEqual(p.goals, [])
  assert.deepEqual(p.days, ['mon', 'wed', 'sun'], 'Tage aus dem Wochenplan')
  assert.equal(L.profileOf(ix, { ...state, profile: { ...p, minutes: 60 } }).minutes, 60, 'gespeichertes Profil gilt')
  let q = L.withGoal(p, 'muscle-up', true)
  q = L.withGoal(L.withGoal(L.withGoal(q, 'l-sit', true), 'handstand', true), 'pistol', true)
  assert.deepEqual(q.goals, ['muscle-up', 'l-sit', 'handstand', 'pistol'], 'mehr als drei Ziele erlaubt')
  q = L.withGoal(L.withGoal(q, 'planche', true), 'front-lever', true)
  assert.equal(L.MAX_GOALS, 5)
  assert.deepEqual(q.goals, ['l-sit', 'handstand', 'pistol', 'planche', 'front-lever'], 'höchstens fünf, das älteste fällt raus')
  assert.deepEqual(L.withGoal(q, 'l-sit', false).goals, ['handstand', 'pistol', 'planche', 'front-lever'])
  const choices = L.skillChoices(ix, state, skills)
  assert.ok(choices.length >= 4)
  assert.ok(choices.every((c, i) => i === 0 || choices[i - 1].reached <= c.reached), 'erreichte am Ende')
  const mu = L.goalProgress(ix, state, [], skills.find((s: { id: string }) => s.id === 'muscle-up'))
  assert.ok(mu.share > 0 && mu.share < 1, 'Muscle-up: Stufe 2 von 3 in der Zug-Leiter')
  assert.ok(mu.pid)
})

test('Verletzung: neue Bereiche (Hüfte, Rücken, Sprunggelenk) sperren passende Übungen', () => {
  const meta = JSON.parse(readFileSync(new URL('../src/seed/exercise-meta.json', import.meta.url), 'utf8')).exercises
  const ankle = [{ id: 'x', kind: 'injury' as const, from: '2026-10-14', tendons: ['ankle' as const] }]
  assert.ok(L.phaseBlock(ankle, meta['pistol-squat']), 'Pistol belastet das Sprunggelenk')
  assert.equal(L.phaseBlock(ankle, meta['pull-up']), null, 'Klimmzug nicht')
  assert.match(L.phaseBlock([{ ...ankle[0], tendons: ['back'] }], meta['dragon-flag'])!, /Rücken/)
  assert.equal(Object.keys(L.TENDON_LABEL).length, 7)
})

test('Verletzung im Muskel: Bereiche aus dem Bewegungsmuster abgeleitet', () => {
  const meta = JSON.parse(readFileSync(new URL('../src/seed/exercise-meta.json', import.meta.url), 'utf8')).exercises
  assert.deepEqual(L.musclesOf('pull-up', meta['pull-up']).sort(), ['arms', 'upperBack'])
  assert.ok(L.musclesOf('dip', meta['dip']).includes('chest'), 'Dips belasten die Brust')
  assert.deepEqual(L.musclesOf('calf-raise-single-leg', meta['calf-raise-single-leg']), ['calf'])
  const chest = [{ id: 'x', kind: 'injury' as const, from: '2026-10-14', tendons: ['chest' as const] }]
  assert.match(L.phaseBlock(chest, meta['decline-push-up'], 'decline-push-up')!, /Brust/)
  assert.equal(L.phaseBlock(chest, meta['pistol-squat'], 'pistol-squat'), null, 'Beine nicht')
  // jede Übung hat mindestens einen Muskelbereich – sonst wäre sie bei Muskelverletzungen nie gesperrt
  for (const [id, m] of Object.entries(meta)) if (id !== 'scapula-shrug') assert.ok(L.musclesOf(id, m as never).length, id)
})

test('Training abbrechen: Stand vor dem Start zurück, sonst Einheit gelöscht', () => {
  const before = sess('2026-10-14', 'push', [['dip', [10]]])
  const after = L.withSet(before, { exercise: 'dip', progression: 'dip', set: 2, value: 9 })
  assert.deepEqual(L.discardedSession(after, before)!.sets, before.sets, 'frühere Sätze bleiben')
  assert.equal(L.discardedSession(after, undefined)!.deleted, true, 'ohne Vorstand gelöscht')
  assert.equal(L.discardedSession(undefined, undefined), undefined)
})

test('Challenges: Vorgabe, Bestwert (mehr bzw. schneller), Formatierung, Cardio getrennt', async () => {
  const { challenges } = JSON.parse(readFileSync(new URL('../src/seed/challenges.json', import.meta.url), 'utf8'))
  const amrap = challenges.find((c: { id: string }) => c.id === 'push-ups-2min'), timed = challenges.find((c: { id: string }) => c.id === '100-pull-ups')
  const hold = challenges.find((c: { id: string }) => c.id === 'dead-hang')
  assert.equal(L.fmtChallengeRule(amrap), 'So viele wie möglich in 2 min')
  const a1 = L.challengeAttempt(amrap, '2026-10-01', 40), a2 = L.challengeAttempt(amrap, '2026-10-08', 46)
  assert.equal(L.challengeBest(amrap, [a1, a2])!.value, 46, 'mehr ist besser')
  const t1 = L.challengeAttempt(timed, '2026-10-01', 600.4, { parts: [12, 10] }), t2 = L.challengeAttempt(timed, '2026-10-08', 540)
  assert.equal(L.challengeBest(timed, [t1, t2])!.value, 540, 'auf Zeit: schneller ist besser')
  assert.equal(t1.value, 600)
  assert.equal(L.fmtActivity(t1), '10:00')
  assert.equal(L.fmtActivity(a2), '46 Wdh.')
  assert.equal(L.fmtChallengeValue(hold, 75), '1:15')
  const run = { id: 'r', date: '2026-10-08', kind: 'run' as const, durationMin: 30 }
  assert.deepEqual(L.cardioOnly([a1, run]), [run])
  assert.equal(L.calendarMarks([], [a1]).cardio.size, 0, 'Challenge ist kein Cardio')
  assert.equal(L.challengeAttempts([a1, a2, t1], amrap.id)[0].date, '2026-10-08', 'neueste zuerst')
  const C = await import('../src/sync/convert.ts')
  assert.ok(C.isActivity(t1))
  assert.deepEqual(C.docToActivity({ ...C.activityToDoc(t1) }).parts, [12, 10], 'Teilsätze überstehen den Sync')
  assert.equal(C.isActivity({ ...a1, value: undefined }), false, 'Challenge ohne Ergebnis ungültig')
})

test('Eigene Challenges: anlegen, bereinigen, mit Vorlagen zusammenführen, löschen', async () => {
  const { challenges } = JSON.parse(readFileSync(new URL('../src/seed/challenges.json', import.meta.url), 'utf8'))
  let st = L.withChallenge(state, { name: '  50 Burpees  ', kind: 'fortime', unit: 'seconds', target: 50 })
  const mine = st.challenges![0]
  assert.equal(mine.name, '50 Burpees')
  assert.equal(mine.unit, 'reps', 'auf Zeit zählt Wiederholungen')
  assert.equal(mine.custom, true)
  assert.match(mine.id, /^my-50-burpees-/)
  assert.equal(L.allChallenges(challenges, st)[0].id, mine.id, 'eigene zuerst')
  st = L.withChallenge(st, { ...mine, target: 60 })
  assert.equal(st.challenges!.length, 1, 'gleiche ID ersetzt')
  assert.equal(st.challenges![0].target, 60)
  const C = await import('../src/sync/convert.ts')
  assert.ok(C.isState(st), 'eigene Challenge besteht die Sync-Prüfung')
  assert.equal(C.isState({ ...st, challenges: [{ ...mine, kind: 'amrap', seconds: 2 }] }), false, 'zu kurze Zeit ungültig')
  assert.deepEqual(C.docToState({ current: {}, paused: [], challenges: st.challenges }).challenges, st.challenges)
  assert.equal(L.withoutChallenge(st, mine.id).challenges!.length, 0)
})

test('Katalog-Ausbau: neue Stufen, Verweise per Übung, bestehende Nutzer behalten ihre Stufe', () => {
  const skills = JSON.parse(readFileSync(new URL('../src/seed/skills.json', import.meta.url), 'utf8')).skills
  const steps = (pid: string) => ix.progressions.get(pid)!.steps.map(s => s.exercise)
  assert.deepEqual(steps('l-sit').slice(0, 3), ['tuck-l-sit', 'one-leg-l-sit', 'l-sit-floor'])
  assert.deepEqual(steps('ring-dip'), ['ring-support-hold', 'rto-support-hold', 'ring-dip', 'rto-dip'])
  assert.deepEqual(steps('row').slice(-2), ['tuck-front-lever-raise', 'ice-cream-maker'], 'angehängt')
  assert.equal(steps('planche-advanced')[0], 'tuck-planche-push-up')
  for (const pid of ['wrists', 'shoulder-prehab', 'hip-hinge', 'rollout', 'anti-rotation']) assert.ok(ix.progressions.has(pid), pid)
  // minStep zeigt weiter auf dieselbe Übung wie vor dem Einfügen
  const pre = (sid: string, pid: string) => skills.find((s: { id: string }) => s.id === sid).prerequisites.find((p: { progression: string }) => p.progression === pid).minStep
  assert.equal(steps('handstand')[pre('freestanding-hspu', 'handstand')], 'handstand-free')
  assert.equal(steps('handstand')[pre('handstand-push-up', 'handstand')], 'handstand-heel-pull')
  assert.equal(steps('l-sit')[pre('v-sit', 'l-sit')], 'l-sit-parallettes')
  assert.equal(steps('vertical-push')[pre('freestanding-hspu', 'vertical-push')], 'handstand-push-up-wall')
  // Platz 11–14: Einstiegsstufen vorn, Skill-Voraussetzungen zeigen weiter auf die freie Übung
  assert.deepEqual(steps('pull-up').slice(0, 3), ['pull-up-negative', 'band-pull-up', 'pull-up'])
  assert.deepEqual(steps('dip').slice(0, 3), ['bar-support-hold', 'dip-negative', 'dip'])
  assert.equal(steps('pull-up')[pre('muscle-up', 'pull-up')], 'pull-up-weighted')
  assert.equal(steps('dip')[pre('planche', 'dip')], 'dip-weighted')
  assert.equal(steps('pull-up')[pre('human-flag', 'pull-up')], 'pull-up')
  assert.equal(steps('horizontal-push')[pre('one-arm-push-up', 'horizontal-push')], 'ring-push-up')
  assert.equal(steps('dip')[pre('korean-dip', 'dip')], 'dip')
  assert.deepEqual(steps('pistol').at(-1), 'pistol-squat-weighted', 'Pistol-Skill bleibt bei derselben Endstufe')
  for (const pid of ['knees', 'korean-dip', 'side-lever']) assert.ok(ix.progressions.has(pid), pid)
  // ohne gewählte Stufe: bisher erste Stufe – bestehende Nutzer bleiben dort, eigene Wahl bleibt
  const st: UserState = { current: { 'l-sit': 'tuck-l-sit' }, paused: [] }
  const pinned = L.withStepPins(st)
  assert.equal(pinned.current['l-sit'], 'tuck-l-sit', 'eigene Wahl bleibt')
  assert.equal(pinned.current.handstand, 'handstand-wall')
  assert.equal(L.currentStep(ix, pinned, 'muscle-up-transition').exercise.id, 'muscle-up-band')
  assert.equal(L.currentStep(ix, pinned, 'planche-advanced').exercise.id, 'adv-tuck-planche')
  assert.equal(L.currentStep(ix, pinned, 'scapula').exercise.id, 'scapula-shrug')
  assert.equal(L.currentStep(ix, pinned, 'pull-up').exercise.id, 'pull-up')
  assert.equal(L.currentStep(ix, pinned, 'row').exercise.id, 'body-row')
  assert.equal(L.currentStep(ix, { current: {}, paused: [] }, 'pull-up').exercise.id, 'pull-up-negative', 'neue Nutzer starten ganz vorn')
  assert.equal(L.needsStepPins(pinned), false)
  for (const p of ix.progressions.values()) for (const s of p.steps) assert.ok(ix.exercises.has(s.exercise), s.exercise)
})

test('Runden-Blöcke: anlegen, Regeln, Ergebnis, Vergleich, Volumen', () => {
  const w = ix.workouts.get('pull')!
  const c = { id: 'c-cindy-1', name: ' Cindy ', mode: 'amrap' as const, minutes: 20, items: [{ exercise: 'pull-up', reps: 5 }, { exercise: 'push-up', reps: 10 }, { exercise: 'air-squat', reps: 15 }] }
  const w1 = L.withCircuit(w, c)
  assert.equal(w1.circuits![0].name, 'Cindy', 'Name getrimmt')
  assert.equal(L.withCircuit(w1, { ...c, minutes: 25 }).circuits!.length, 1, 'ersetzt statt doppelt')
  assert.equal(L.withoutCircuit(w1, c.id).circuits!.length, 0)
  assert.equal(L.fmtCircuitRule(c), 'Max. Runden · 20 min')
  assert.equal(L.fmtCircuitRule({ ...c, mode: 'rounds', rounds: 5 }), '5 Runden auf Zeit')
  assert.match(L.fmtCircuitItems(ix, c), /^5 .+ · 10 .+ · 15 /)
  const r = { id: c.id, rounds: 14, reps: 7 }
  assert.equal(L.fmtCircuitResult(c, r), '14 Runden + 7')
  assert.equal(L.fmtCircuitResult(c, { id: c.id, rounds: 1 }), '1 Runde')
  assert.equal(L.fmtCircuitResult({ mode: 'rounds' }, { id: c.id, rounds: 5, durationSec: 754 }), '12:34')
  assert.ok(L.circuitBetter(c, { id: c.id, rounds: 14, reps: 8 }, r))
  assert.ok(L.circuitBetter({ mode: 'rounds' }, { id: 'x', rounds: 5, durationSec: 600 }, { id: 'x', rounds: 5, durationSec: 700 }), 'schneller ist besser')
  assert.deepEqual(L.circuitVolume(c, r).map(x => x.reps), [75, 142, 210], 'volle Runden + 5 Klimmzüge + 2 Liegestütze')
  const s = L.withCircuitResult(L.emptySession('2026-10-14', 'pull'), r)
  assert.ok(L.isTrained(s), 'nur Runden zählt als Training')
  assert.deepEqual(L.lastCircuitResult([s], c.id, '2026-10-15'), { date: '2026-10-14', r })
  assert.equal(L.lastCircuitResult([s], c.id, '2026-10-14'), null, 'nur frühere Tage')
})

test('Schnellauswahl Workouts: heutiges zuerst, dann zuletzt trainierte, höchstens n', () => {
  const ss = [sess('2026-10-01', 'legs', [['pistol-squat', [5]]]), sess('2026-10-05', 'pull', [['pull-up', [8]]])]
  assert.deepEqual(L.recentWorkouts(ix, ss, 'push').map(w => w.id), ['push', 'pull', 'legs'])
  assert.deepEqual(L.recentWorkouts(ix, ss, 'push', 2).map(w => w.id), ['push', 'pull'])
})

test('Kann ich schon: Ziel-Leitern auf die letzte Stufe, Skill erreicht', () => {
  const skills = JSON.parse(readFileSync(new URL('../src/seed/skills.json', import.meta.url), 'utf8')).skills
  const wd = skills.find((s: { id: string }) => s.id === 'weighted-dip')
  const next = L.withSkillReached(ix, state, wd)
  for (const pid of wd.targets) assert.equal(L.currentStep(ix, next, pid).next, undefined, `${pid} auf letzter Stufe`)
  assert.equal(L.skillChoices(ix, next, skills).find(c => c.skill === 'weighted-dip')!.reached, true)
  assert.equal(next.current['muscle-up-pull'], state.current['muscle-up-pull'], 'andere Leitern unverändert')
})

test('Zielvorschläge: ohne Ziele, Erreichtes und Mittrainiertes, mit konkreter Begründung', () => {
  const skills = JSON.parse(readFileSync(new URL('../src/seed/skills.json', import.meta.url), 'utf8')).skills
  const withMu: UserState = { ...state, profile: { ...L.profileOf(ix, state), goals: ['muscle-up'] } }
  const ideas = L.goalIdeas(ix, withMu, skills)
  assert.equal(ideas.length, 3)
  assert.ok(!ideas.some(x => x.skill === 'muscle-up'), 'gewähltes Ziel nicht vorgeschlagen')
  const choices = L.skillChoices(ix, withMu, skills)
  const inMu = choices.filter(c => c.partOf.includes('muscle-up')).map(c => c.skill)
  assert.ok(!ideas.some(x => inMu.includes(x.skill)), 'was der Muscle-up mittrainiert, fehlt')
  const order = { next: 0, work: 1, long: 2 }
  assert.ok(ideas.every((x, i) => i === 0 || order[ideas[i - 1].tier] <= order[x.tier]), 'realistischste zuerst')
  assert.ok(ideas.every(x => x.reason.length > 0))
  // Begründung: begonnene Leiter → Stand, fehlende Voraussetzung → was fehlt
  const mu = choices.find(c => c.skill === 'muscle-up')!
  assert.match(L.goalReason(ix, withMu, skills, mu), mu.missing.length ? new RegExp(mu.missing[0]) : /Stufe 2\/3/)
})

test('Planvorschlag: Generator → Nutzerplan, Diff, gleicher Plan = kein Vorschlag', async () => {
  const { generatePlan } = await import('../src/domain/generator.ts')
  const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
  const skills = json('skills.json').skills, splits = json('splits.json').splits, meta = json('exercise-meta.json').exercises
  assert.equal(L.generatorInput(ix, state, skills, splits), null, 'ohne Ziele kein Vorschlag')
  const user = { ...state, profile: { goals: ['muscle-up', 'l-sit'], equipment: ['bar', 'rings', 'parallettes', 'band'], days: ['sun', 'mon', 'wed'], minutes: 90 } } as typeof state
  const input = L.generatorInput(ix, user, skills, splits)!
  assert.equal(input.split, 'full-3', 'Muscle-up + L-Sit (Zug + Rumpf) → Ganzkörper ×3')
  assert.ok(input.equipment.includes('floor') && input.equipment.includes('wall'))
  const g = generatePlan({ catalog, meta, skills, splits }, input)
  const base = L.planFromCatalog(catalog)
  base.workouts.push({ ...L.newWorkout(ix, 'Eigen', []), id: 'eigen' })
  const plan = L.planFromGenerated(ix, base, g, input)
  assert.deepEqual(Object.keys(plan.weekplan).sort(), ['mon', 'sun', 'wed'])
  assert.ok(Object.values(plan.weekplan).every(id => id!.startsWith('auto-')))
  assert.equal(plan.source, 'generated')
  assert.ok(plan.workouts.filter(w => w.id.startsWith('auto-')).every(w => w.warmup.length > 0), 'Warm-up aus dem Katalog übernommen')
  assert.ok(plan.workouts.find(w => w.id === 'pull')!.archived, 'alte Workouts bleiben als gelöscht (Verlauf)')
  assert.equal(plan.workouts.find(w => w.id === 'eigen')!.archived, undefined, 'eigene bleiben aktiv')
  assert.equal(L.samePlan(ix, plan), false)
  const diff = L.planDiff(ix, user, plan)
  assert.deepEqual(diff.map(d => d.day), ['mon', 'wed', 'sun'])
  assert.ok(diff.some(d => d.changes.some(c => c.kind === 'neu')) && diff.some(d => d.changes.some(c => c.kind === 'raus')))
  const after = L.indexCatalog(L.effectiveCatalog(catalog, plan))
  assert.equal(L.samePlan(after, L.planFromGenerated(after, plan, g, input)), true, 'nach Übernahme kein neuer Vorschlag')
  // Wochenvorschau je Split-Vorlage: dieselbe Zuordnung Tag → Thema wie der Generator
  for (const split of splits.filter((x: { themes: unknown[] }) => x.themes.length === 3)) {
    const week = L.splitWeek(ix, user, skills, split, meta)
    const gen = generatePlan({ catalog, meta, skills, splits }, { ...input, split: split.id })
    assert.deepEqual(week.map(w => [w.day, w.theme.name]), gen.days.map(d => [d.day, d.theme]), `Vorschau ${split.id} = Generator`)
  }
  assert.deepEqual(L.splitWeek(ix, user, skills, splits.find((x: { id: string }) => x.id === 'ul-2'), meta), [], 'falsche Zahl Tage → leer')
})

test('Phasen: Verletzung/Equipment lassen Übungen ruhen, Pause hält die Serie, Wiedereinstieg leichter', () => {
  const meta = JSON.parse(readFileSync(new URL('../src/seed/exercise-meta.json', import.meta.url), 'utf8')).exercises
  const inj = L.newPhase('injury', '2026-10-14', null, { tendons: ['shoulder'] })
  assert.equal(inj.to, undefined)
  let user = L.withPhase(state, inj)
  assert.equal(L.activePhases(user, '2026-10-13').length, 0)
  assert.equal(L.activePhases(user, '2026-12-01').length, 1, 'bis auf Weiteres')
  const push = L.workoutSlots(ix, 'push', user, undefined, [], '2026-10-15', { meta })
  assert.ok(push.some(s => s.blockedBy?.startsWith('Verletzung') && s.state === 'paused'), 'Schulter-Übungen ruhen')
  assert.ok(push.some(s => !s.blockedBy), 'andere bleiben')
  assert.equal(L.workoutSlots(ix, 'push', user, undefined, [], '2026-10-15').some(s => s.blockedBy), false, 'ohne Metadaten keine Sperre')
  user = L.withPhaseEnded(user, inj.id, '2026-10-20')
  assert.equal(user.phases![0].to, '2026-10-19')
  assert.equal(L.withPhaseEnded(user, inj.id, '2026-10-14').phases!.length, 0, 'am Starttag beendet = weg')
  const eq = L.withPhase(state, L.newPhase('equipment', '2026-10-14', 7, { equipment: [] }))
  assert.ok(L.workoutSlots(ix, 'pull', eq, undefined, [], '2026-10-15', { meta }).some(s => s.blockedBy === 'Gerät fehlt'))
  // Pause: Serie bleibt, danach eine Woche ein Satz weniger
  const pause = L.withPhase(state, L.newPhase('pause', '2026-10-05', 14))
  assert.equal(pause.phases![0].to, '2026-10-18')
  assert.equal(L.restingPhase(pause, '2026-10-10')!.kind, 'pause')
  const trained = (date: string) => ({ ...L.emptySession(date, 'pull'), durationSec: 3600 })
  const sessions = [trained('2026-09-21'), trained('2026-09-28'), trained('2026-10-20')]
  assert.equal(L.streakWeeks(sessions, '2026-10-21'), 1, 'ohne Pause gerissen')
  assert.equal(L.streakWeeks(sessions, '2026-10-21', pause.phases), 3, 'Pausenwochen halten die Serie')
  assert.equal(L.reentry(pause, '2026-10-20'), true)
  assert.equal(L.reentry(pause, '2026-10-26'), false)
  const normal = L.workoutSlots(ix, 'pull', state, undefined, [], '2026-10-20')
  const light = L.workoutSlots(ix, 'pull', pause, undefined, [], '2026-10-20')
  assert.ok(light.every((s, i) => s.planned === Math.max(2, normal[i].planned - 1)))
})

test('Phasen: Ersatzübung mit gleichem Muster; Split aus dem Profil', () => {
  const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
  const meta = json('exercise-meta.json').exercises
  const user = L.withPhase(state, L.newPhase('injury', '2026-10-14', null, { tendons: ['wrist'] }))
  const slots = L.workoutSlots(ix, 'push', user, undefined, [], '2026-10-15', { meta })
  const blocked = slots.filter(s => s.blockedBy)
  const subs = slots.filter(s => s.substituteFor)
  assert.ok(blocked.length > 0)
  for (const sub of subs) {
    const i = slots.indexOf(sub)
    assert.equal(slots[i - 1].step.exercise.name, sub.substituteFor, 'Ersatz direkt hinter der ruhenden Übung')
    assert.equal(sub.blockedBy, undefined, 'Ersatz belastet das Gelenk nicht')
    assert.equal(meta[sub.step.exercise.id].pattern, meta[slots[i - 1].step.exercise.id].pattern)
  }
  assert.equal(new Set(slots.map(s => s.pid)).size, slots.length, 'keine Leiter doppelt')
  // Split: gewählte Vorlage gilt, solange sie zur Zahl der Tage passt
  const skills = json('skills.json').skills, splits = json('splits.json').splits
  const prof = { goals: ['muscle-up', 'l-sit'], equipment: ['bar'], days: ['sun', 'mon', 'wed'], minutes: 90 }
  const withSplit = (split?: string) => L.generatorInput(ix, { ...state, profile: { ...prof, split } } as typeof state, skills, splits)!.split
  assert.equal(withSplit(), 'full-3')
  assert.equal(withSplit('ppl-3'), 'ppl-3')
  assert.equal(withSplit('ul-4'), 'full-3', 'passt nicht zu drei Tagen → automatisch')
})

test('Einstufung: nur höher, nie zurück; übernehmen setzt die Stufe', async () => {
  const { placement } = await import('../src/domain/assessment.ts')
  const data = JSON.parse(readFileSync(new URL('../src/seed/assessment.json', import.meta.url), 'utf8'))
  const placed = placement(data, catalog, { 'pull-ups': 16, dips: 0 })
  const changes = L.placementChanges(ix, state, placed)
  assert.ok(changes.some(c => c.pid === 'pull-up' && c.to === 3), '16 Klimmzüge → mit Gewicht')
  assert.ok(changes.every(c => c.to > c.from), 'nie zurück')
  assert.equal(changes.some(c => c.pid === 'muscle-up-pull'), true, 'Muscle-up-Zug: 16 Klimmzüge → Stufe 3')
  const next = L.withPlacement(ix, state, changes)
  assert.equal(L.currentStep(ix, next, 'pull-up').exercise.id, 'pull-up-weighted')
  assert.deepEqual(L.placementChanges(ix, next, placed), [], 'danach nichts mehr zu tun')
})

test('Vorlagen: Plan auf deine Trainingstage, Workout als eigene Kopie', () => {
  const templates = JSON.parse(readFileSync(new URL('../src/seed/templates.json', import.meta.url), 'utf8')).templates
  const pids = new Set(catalog.progressions.map(p => p.id))
  for (const tp of templates) for (const w of tp.workouts) for (const s of w.slots) assert.ok(pids.has(s.progression), `${tp.id}: ${s.progression}`)
  const beg = templates.find((x: { id: string }) => x.id === 'beginner-full-3')
  const base = L.planFromCatalog(catalog)
  const onTpl = L.planFromTemplate(ix, base, beg)
  assert.deepEqual(Object.keys(onTpl.weekplan).sort(), ['fri', 'mon', 'wed'], 'ohne passende Tage: Tage der Vorlage')
  const onMine = L.planFromTemplate(ix, base, beg, ['tue', 'thu', 'sat'])
  assert.deepEqual(onMine.weekplan, { tue: 'beginner-full-3-a', thu: 'beginner-full-3-b', sat: 'beginner-full-3-c' }, 'auf deinen Tagen, in Reihenfolge')
  assert.ok(onMine.workouts.find(w => w.id === 'pull')!.archived, 'alte Workouts bleiben für den Verlauf')
  assert.equal(L.samePlan(L.indexCatalog(L.effectiveCatalog(catalog, onMine)), onMine), true)
  const fin = templates.find((x: { id: string }) => x.id === 'core-finisher')
  const w = L.workoutFromTemplate(ix, fin)
  assert.equal(w.custom, true)
  assert.equal(w.id, 'core-finisher')
  assert.equal(w.slots.length, fin.workouts[0].slots.length)
})

test('Feste Übung im Workout: andere Stufe als die eigene, wächst nicht mit, schaltet nicht frei', () => {
  const w = ix.workouts.get('push')!
  const fixed = L.withSlotExercise(ix, w, 'horizontal-push', 'push-up')
  const sl = fixed.slots.find(s => s.progression === 'horizontal-push')!
  assert.equal(sl.exercise, 'push-up')
  const st = L.slotStep(ix, { current: { 'horizontal-push': 'ring-push-up' }, paused: [] }, sl)
  assert.equal(st.exercise.id, 'push-up'); assert.equal(st.fixed, true)
  assert.equal(L.slotStep(ix, state, { progression: 'horizontal-push', exercise: 'gibt-es-nicht' }).fixed, undefined, 'unbekannte Übung → mitwachsend')
  assert.equal(L.withSlotExercise(ix, fixed, 'horizontal-push', undefined).slots.find(s => s.progression === 'horizontal-push')!.exercise, undefined)
})

test('Zusammenfassung: Wiederholungen aus Runden-Blöcken zählen mit', () => {
  const c = { id: 'c-cindy', name: 'Runden', mode: 'amrap' as const, minutes: 20, items: [{ exercise: 'pull-up', reps: 5 }, { exercise: 'push-up', reps: 10 }, { exercise: 'air-squat', reps: 15 }] }
  const w = L.withCircuit({ ...ix.workouts.get('pull')!, slots: [] }, c)
  const ix2 = { ...ix, workouts: new Map(ix.workouts).set(w.id, w) }
  const s = L.withCircuitResult(L.emptySession('2026-10-15', w.id), { id: c.id, rounds: 5 })
  assert.equal(L.sessionSummary(ix2, [s], s).reps, 150, '5 Runden × 30')
  assert.deepEqual(L.withoutCircuitResult(s, c.id).circuits, [])
})

test('mehrere Einheiten desselben Workouts am Tag: -2, -3 …, gelöschte zählen nicht', () => {
  const a = L.emptySession('2026-10-15', 'pull')
  assert.equal(L.sessionId('2026-10-15', 'pull', 2), '2026-10-15-pull-2')
  assert.deepEqual(L.latestSessionId([], '2026-10-15', 'pull'), { id: '2026-10-15-pull', n: 1 })
  const b = { ...a, id: L.sessionId('2026-10-15', 'pull', 2) }
  assert.deepEqual(L.latestSessionId([a, b], '2026-10-15', 'pull'), { id: '2026-10-15-pull-2', n: 2 })
  assert.deepEqual(L.latestSessionId(new Map([[a.id, a], [b.id, { ...b, deleted: true }]]), '2026-10-15', 'pull'), { id: '2026-10-15-pull', n: 1 })
})

test('Löschen/Verwerfen einer zweiten Einheit am Tag trifft genau diese, nicht die erste', () => {
  const second = { ...L.emptySession('2026-10-15', 'cindy'), id: L.sessionId('2026-10-15', 'cindy', 2), sets: [] }
  assert.equal(L.deletedSession(second).id, '2026-10-15-cindy-2')
  assert.equal(L.discardedSession(second, undefined)?.id, '2026-10-15-cindy-2')
})

test('Leiter-Suche: findet Übungen auch in Ergänzungs-Leitern, ohne Umlaute/Groß-Klein', () => {
  const ix = L.indexCatalog(catalog)
  const user = { current: {}, paused: [] } as unknown as Parameters<typeof L.searchLadders>[1]
  const hits = L.searchLadders(ix, user, 'bulgarian')
  assert.ok(hits.some(h => /bulgarian/i.test(h.exercise.name)), 'Bulgarian Split Squat gefunden')
  assert.ok(L.searchLadders(ix, user, 'KLIMMZUGE').length > 0 || L.searchLadders(ix, user, 'klimmzüge').length > 0)
  assert.deepEqual(L.searchLadders(ix, user, '   '), [])
})
