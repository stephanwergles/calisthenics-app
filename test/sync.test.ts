/* node --test test/sync.test.ts – Übersetzung Payload ↔ App und Eingabeprüfung */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Plan, Session } from '../src/domain/model.ts'
import * as C from '../src/sync/convert.ts'

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/seed/catalog.json', import.meta.url), 'utf8'))

/** so ungefähr gibt Payload Dokumente zurück: null statt fehlend, Zeilen mit eigener id */
function asPayload(v: any): any {
  if (Array.isArray(v)) return v.map((x, i) => (x && typeof x === 'object' && !Array.isArray(x) ? { id: `row${i}`, ...asPayload(x) } : x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === undefined ? null : asPayload(x)]))
  return v
}

test('Katalog übersteht Seed → Datenbank → Sync unverändert', () => {
  const d = C.catalogToDocs(catalog)
  const withNulls = (doc: any, fill: string[]) => { for (const f of fill) if (!(f in doc)) doc[f] = null; return doc }
  const exs = d.exercises.map(e => withNulls(asPayload({ id: e.id, ...e.data }), []))
  const progs = d.progressions.map(p => {
    const doc = asPayload({ id: p.id, ...p.data })
    doc.steps.forEach((s: any) => withNulls(s.target, ['min', 'max']))
    return doc
  })
  const works = d.workouts.map(w => asPayload({ id: w.id, ...w.data }))
  const week = { id: 1, mon: 'legs', tue: null, wed: 'push', thu: null, fri: null, sat: null, sun: 'pull', updatedAt: 'x' }
  const back = C.buildCatalog(exs, progs, works, week)
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
  assert.deepEqual([...back.exercises].sort(byId), [...catalog.exercises].sort(byId))
  assert.deepEqual([...back.progressions].sort(byId), [...catalog.progressions].sort(byId))
  assert.deepEqual([...back.workouts].sort(byId), [...catalog.workouts].sort(byId))
  assert.deepEqual(back.weekplan, catalog.weekplan)
  assert.ok(C.catalogUsable(back))
})

test('Katalog mit kaputten Verweisen wird nicht übernommen', () => {
  const broken = structuredClone(catalog)
  broken.progressions[0].steps[0].exercise = 'gibt-es-nicht'
  assert.equal(C.catalogUsable(broken), false)
  assert.equal(C.catalogUsable(null), false)
})

const session: Session = {
  id: '2026-09-30-pull', date: '2026-09-30', workout: 'pull', durationSec: 4189,
  sets: [
    { exercise: 'pull-up', progression: 'pull-up', set: 1, value: 5, weightKg: 5 },
    { exercise: 'muscle-up-band', progression: 'muscle-up-transition', set: 2, value: 1, attempts: 5, note: 'knapp' },
  ],
  skipped: ['body-row'], routineDone: ['pull-warm-armkreisen'], setPlan: { 'pull-up': 3 },
  note: 'Schulter links zwickt bei Dips', updatedAt: 1790000000000,
}

test('Einheit übersteht den Weg zum Server und zurück', () => {
  const doc = asPayload({ id: 42, user: 1, ...C.sessionToDoc(session), createdAt: 'x', updatedAt: 'y' })
  assert.deepEqual(C.docToSession(doc), session)
  const bare = C.docToSession(asPayload({ ...C.sessionToDoc({ ...session, durationSec: undefined, setPlan: undefined, updatedAt: undefined }) }))
  assert.equal('durationSec' in bare, false, 'null wird nicht zu einem Feld')
  assert.equal('setPlan' in bare, false)
  assert.equal('note' in C.docToSession(asPayload({ ...C.sessionToDoc({ ...session, note: undefined }) })), false)
})

test('Gelöschte Einheit kommt als Markierung an und überschreibt die alte Fassung', async () => {
  const { takeRemote } = await import('../src/core/api.ts')
  const tomb: Session = { id: session.id, date: session.date, workout: session.workout, sets: [], skipped: [], routineDone: [], deleted: true, updatedAt: 1790000009999 }
  assert.deepEqual(C.docToSession(asPayload({ id: 42, ...C.sessionToDoc(tomb) })), tomb)
  assert.equal('deleted' in C.docToSession(asPayload({ ...C.sessionToDoc(session) })), false, 'nicht gelöscht = kein Feld')
  assert.ok(C.isSession(tomb))
  assert.equal(C.isSession({ ...tomb, deleted: 'ja' }), false)
  assert.ok(takeRemote(session, tomb, true), 'jüngere Löschung gewinnt auch gegen ungesendete ältere Änderung')
})

test('Aktivität und Trainingsstand', () => {
  const a = { id: '2026-09-27-run-1', date: '2026-09-27', kind: 'run' as const, durationMin: 45, distanceKm: 8, updatedAt: 5 }
  assert.deepEqual(C.docToActivity(asPayload({ id: 7, ...C.activityToDoc(a) })), a)
  const ch = { id: '2026-10-14-100-pull-ups-x', date: '2026-10-14', kind: 'challenge' as const, name: '100 Klimmzüge auf Zeit',
    challenge: '100-pull-ups', value: 540, durationSec: 540, parts: [15, 12, 10], note: 'zäh', updatedAt: 6 }
  assert.deepEqual(C.docToActivity(asPayload({ id: 8, ...C.activityToDoc(ch) })), ch, 'Challenge-Versuch übersteht den Sync')
  assert.deepEqual(C.docToState({ current: { 'l-sit': 'l-sit-parallettes' }, paused: [{ id: 'one-arm-pull' }], clientUpdatedAt: 9 }),
    { current: { 'l-sit': 'l-sit-parallettes' }, paused: ['one-arm-pull'], updatedAt: 9 })
  assert.deepEqual(C.docToState(null), { current: {}, paused: [] })
})

test('Eingaben vom Gerät werden geprüft', () => {
  assert.ok(C.isSession(session))
  assert.equal(C.isSession({ ...session, id: '2026-09-30-push' }), false, 'ID passt nicht zu Datum/Workout')
  assert.equal(C.isSession({ ...session, date: '30.09.2026', id: '30.09.2026-pull' }), false)
  assert.equal(C.isSession({ ...session, sets: [{ exercise: 'x', progression: 'y', set: '1', value: 5 }] }), false)
  assert.equal(C.isSession({ ...session, skipped: ['<script>'] }), false)
  assert.equal(C.isSession({ ...session, note: 'x'.repeat(C.NOTE_MAX + 1) }), false, 'Notiz zu lang')
  assert.equal(C.isSession({ ...session, note: 42 }), false)
  assert.equal(C.isSession({ ...session, sets: [{ ...session.sets[0], note: { a: 1 } }] }), false)
  assert.ok(C.isActivity({ id: '2026-09-27-run-1', date: '2026-09-27', kind: 'run' }))
  assert.equal(C.isActivity({ id: '2026-09-27-x-1', date: '2026-09-27', kind: 'swim' }), false)
  assert.ok(C.isState({ current: { pistol: 'pistol-squat' }, paused: [] }))
  assert.equal(C.isState({ current: { pistol: 42 }, paused: [] }), false)
})

test('Konfliktregel: wann ersetzt die Server-Fassung die lokale?', async () => {
  const { takeRemote } = await import('../src/core/api.ts')
  assert.equal(takeRemote(undefined, { updatedAt: 1 }, false), true, 'lokal unbekannt')
  assert.equal(takeRemote({ updatedAt: 9 }, { updatedAt: 1 }, false), true, 'lokal sauber: Server ist maßgeblich')
  assert.equal(takeRemote({ updatedAt: 9 }, { updatedAt: 1 }, true), false, 'lokal ungesendet und jünger: bleibt')
  assert.equal(takeRemote({ updatedAt: 1 }, { updatedAt: 9 }, true), true, 'Server jünger: gewinnt')
})

test('Einheit: Plan-Schlüssel statt Katalog-Verknüpfung, ältere Einheiten weiter lesbar', () => {
  const custom = { ...session, id: '2026-09-30-mein-oberkoerper', workout: 'mein-oberkoerper' }
  const doc = C.sessionToDoc(custom)
  assert.equal(doc.workoutKey, 'mein-oberkoerper')
  assert.deepEqual(C.docToSession(asPayload({ ...doc, workout: null })), custom, 'eigenes Workout ohne Katalog-Verknüpfung')
  const old = asPayload({ ...C.sessionToDoc(session), workoutKey: null, workout: { id: 'pull', name: 'Tag A' } })
  assert.equal(C.docToSession(old).workout, 'pull', 'alte Einheit ohne Schlüssel → Katalog-Workout')
})

const plan: Plan = {
  id: 'main', version: 3, name: 'Mein Plan', source: 'custom', updatedAt: 1790000000500,
  workouts: [
    { ...catalog.workouts[0] },
    { id: 'mein-oberkoerper', name: 'Oberkörper kurz', focus: 'Zug · Druck', warmup: [], cooldown: [],
      slots: [{ block: 'strength', progression: 'pull-up' }, { block: 'strength', progression: 'dip' }] },
  ],
  weekplan: { sun: catalog.workouts[0].id, thu: 'mein-oberkoerper' },
  inputs: { skills: ['muscle-up'], equipment: ['bar'], days: ['sun', 'thu'], minutes: 60 },
}

test('Plan übersteht den Weg zum Server und zurück', () => {
  // workouts/weekplan/inputs sind JSON-Felder: Payload gibt sie unverändert zurück (keine Zeilen-IDs)
  const fromDb = (p: Plan) => { const d = C.planToDoc(p); return { id: 9, user: 1, ...asPayload({ ...d, workouts: undefined, weekplan: undefined, inputs: undefined }), workouts: d.workouts, weekplan: d.weekplan, inputs: d.inputs } }
  assert.deepEqual(C.docToPlan(fromDb(plan)), plan)
  assert.equal('inputs' in C.docToPlan(fromDb({ ...plan, inputs: undefined })), false)
})

test('Plan-Eingaben werden geprüft', () => {
  assert.ok(C.isPlan(plan))
  assert.equal(C.isPlan({ ...plan, weekplan: { mon: 'gibt-es-nicht' } }), false, 'Wochenplan zeigt auf unbekanntes Workout')
  assert.equal(C.isPlan({ ...plan, weekplan: { funday: plan.workouts[0].id } }), false)
  assert.equal(C.isPlan({ ...plan, workouts: [{ ...plan.workouts[0], id: '<x>' }] }), false)
  assert.equal(C.isPlan({ ...plan, version: 1.5 }), false)
  const w0 = plan.workouts[0]
  assert.ok(C.isPlan({ ...plan, workouts: [{ ...w0, custom: true, slots: [{ ...w0.slots[0], sets: 5 }] }, ...plan.workouts.slice(1)] }), 'Satzzahl im Slot')
  assert.equal(C.isPlan({ ...plan, workouts: [{ ...w0, slots: [{ ...w0.slots[0], sets: 0 }] }, ...plan.workouts.slice(1)] }), false)
  assert.equal(C.isPlan({ ...plan, workouts: [{ ...w0, slots: [{ ...w0.slots[0], sets: 11 }] }, ...plan.workouts.slice(1)] }), false)
  assert.equal(C.isPlan({ ...plan, workouts: plan.workouts.map(w => ({ ...w, archived: true })) }), false, 'Wochenplan auf gelöschtes Workout')
  assert.equal(C.isPlan({ ...plan, name: 'x'.repeat(81) }), false)
})

test('Tagesanpassung und eigene Workout-Felder überleben den Sync', () => {
  const adj: Session = { ...session, added: ['pistol'], removed: ['body-row'] }
  const doc = C.sessionToDoc(adj)
  assert.deepEqual(doc.adjust, { added: ['pistol'], removed: ['body-row'] })
  assert.deepEqual(C.docToSession(asPayload(doc)), adj)
  assert.equal(C.sessionToDoc(session).adjust, null)
  assert.equal('added' in C.docToSession(asPayload(C.sessionToDoc(session))), false)
  assert.equal(C.isSession(adj), true)
  assert.equal(C.isSession({ ...adj, added: ['<x>'] }), false)
  assert.equal(C.isSession({ ...adj, removed: 'pistol' }), false)
})

test('Profil im Trainingsstand übersteht den Sync und wird geprüft', () => {
  const profile = { goals: ['muscle-up', 'l-sit'], equipment: ['bar', 'rings'], days: ['mon', 'wed', 'sun'], minutes: 90 } as const
  const st = C.docToState({ current: { 'pull-up': 'pull-up' }, paused: [], profile, clientUpdatedAt: 5 })
  assert.deepEqual(st.profile, profile)
  assert.equal('profile' in C.docToState({ current: {}, paused: [], profile: null }), false)
  assert.equal(C.isState({ current: {}, paused: [], profile }), true)
  assert.equal(C.isState({ current: {}, paused: [], profile: { ...profile, goals: ['a', 'b', 'c', 'd', 'e'] } }), true, 'fünf Ziele')
  assert.equal(C.isState({ current: {}, paused: [], profile: { ...profile, goals: ['a', 'b', 'c', 'd', 'e', 'f'] } }), false, 'höchstens fünf Ziele')
  assert.equal(C.isState({ current: {}, paused: [], profile: { ...profile, equipment: ['jetpack'] } }), false)
  assert.equal(C.isState({ current: {}, paused: [], profile: { ...profile, minutes: 5 } }), false)
  assert.equal(C.isState({ current: {}, paused: [], profile: { ...profile, days: ['funday'] } }), false)
})

test('Phasen im Trainingsstand: Sync und Prüfung', () => {
  const phases = [{ id: '2026-10-14-injury', kind: 'injury', from: '2026-10-14', tendons: ['shoulder'] }, { id: '2026-10-01-pause', kind: 'pause', from: '2026-10-01', to: '2026-10-07' }]
  assert.deepEqual(C.docToState({ current: {}, paused: [], phases }).phases, phases)
  assert.equal('phases' in C.docToState({ current: {}, paused: [], phases: [] }), false)
  assert.equal(C.isState({ current: {}, paused: [], phases }), true)
  assert.equal(C.isState({ current: {}, paused: [], phases: [{ ...phases[1], to: '2026-09-01' }] }), false, 'Ende vor Beginn')
  assert.equal(C.isState({ current: {}, paused: [], phases: [{ ...phases[0], tendons: ['nose'] }] }), false)
  assert.equal(C.isState({ current: {}, paused: [], phases: [{ ...phases[0], tendons: ['hip', 'back', 'ankle'] }] }), true, 'Hüfte, Rücken, Sprunggelenk gültig')
  assert.equal(C.isState({ current: {}, paused: [], phases: [{ ...phases[0], tendons: ['chest', 'calf'] }] }), true, 'Muskelbereiche gültig')
  assert.equal(C.isState({ current: {}, paused: [], phases: [{ ...phases[0], kind: 'party' }] }), false)
})

test('v3-Katalog: Metadaten, Skills, Splits, Einstufung überstehen Payload und zurück', () => {
  const seed = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
  const meta = seed('exercise-meta.json').exercises, skills = seed('skills.json').skills, splits = seed('splits.json').splits, assess = seed('assessment.json')
  const docs = C.catalogToDocs(catalog)
  const exs = docs.exercises.map(e => ({ id: e.id, ...e.data, ...(meta[e.id] ? { meta: C.metaToDoc(meta[e.id]) } : {}) }))
  const progs = docs.progressions.map(p => {
    const r = assess.rules.find((x: { progression: string }) => x.progression === p.id)
    return { id: p.id, ...p.data, ...(r ? { assessment: { test: r.test, thresholds: r.thresholds } } : {}) }
  })
  const works = docs.workouts.map(w => ({ id: w.id, ...w.data, warmup: w.data.warmup, cooldown: w.data.cooldown }))
  const out = C.buildCatalog(exs as never, progs as never, works as never, docs.weekplan as never, {
    skills: skills.map((s: { id: string }) => ({ id: s.id, ...C.skillToDoc(s as never) })),
    splits: splits.map((t: { id: string }) => ({ id: t.id, ...C.splitToDoc(t as never) })),
    assessment: { tests: assess.tests.map((t: { id: string; name: string; unit: string; levels?: string[] }) => ({ key: t.id, name: t.name, unit: t.unit, levels: t.levels ?? [] })) },
  })
  const known = Object.fromEntries(Object.entries(meta).filter(([id]) => catalog.exercises.some(e => e.id === id)))
  assert.deepEqual(out.meta, known)
  assert.deepEqual(out.skills, skills)
  assert.deepEqual(out.splits, splits)
  assert.deepEqual(out.assessment!.tests, assess.tests)
  assert.deepEqual(out.assessment!.rules.sort((a, b) => a.progression.localeCompare(b.progression)),
    [...assess.rules].sort((a: { progression: string }, b: { progression: string }) => a.progression.localeCompare(b.progression)))
  assert.equal('meta' in C.buildCatalog(exs.map(e => ({ ...e, meta: undefined })) as never, progs as never, works as never, null), false, 'ohne Pflege kein Feld')
})

test('Vorlagen überstehen Payload und zurück', () => {
  const tpls = JSON.parse(readFileSync(new URL('../src/seed/templates.json', import.meta.url), 'utf8')).templates
  const docs = C.catalogToDocs(catalog)
  const out = C.buildCatalog(docs.exercises.map(e => ({ id: e.id, ...e.data })) as never, docs.progressions.map(p => ({ id: p.id, ...p.data })) as never,
    docs.workouts.map(w => ({ id: w.id, ...w.data })) as never, null, { templates: tpls.map((t: { id: string }) => ({ id: t.id, ...C.templateToDoc(t as never) })) })
  assert.deepEqual(out.templates, tpls)
})
