/* node --test test/sync.test.ts – Übersetzung Payload ↔ App und Eingabeprüfung */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Session } from '../src/domain/model.ts'
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
  skipped: ['body-row'], routineDone: ['pull-warm-armkreisen'], setPlan: { 'pull-up': 3 }, updatedAt: 1790000000000,
}

test('Einheit übersteht den Weg zum Server und zurück', () => {
  const doc = asPayload({ id: 42, user: 1, ...C.sessionToDoc(session), createdAt: 'x', updatedAt: 'y' })
  assert.deepEqual(C.docToSession(doc), session)
  const bare = C.docToSession(asPayload({ ...C.sessionToDoc({ ...session, durationSec: undefined, setPlan: undefined, updatedAt: undefined }) }))
  assert.equal('durationSec' in bare, false, 'null wird nicht zu einem Feld')
  assert.equal('setPlan' in bare, false)
})

test('Aktivität und Trainingsstand', () => {
  const a = { id: '2026-09-27-run-1', date: '2026-09-27', kind: 'run' as const, durationMin: 45, distanceKm: 8, updatedAt: 5 }
  assert.deepEqual(C.docToActivity(asPayload({ id: 7, ...C.activityToDoc(a) })), a)
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
  assert.ok(C.isActivity({ id: '2026-09-27-run-1', date: '2026-09-27', kind: 'run' }))
  assert.equal(C.isActivity({ id: '2026-09-27-x-1', date: '2026-09-27', kind: 'swim' }), false)
  assert.ok(C.isState({ current: { pistol: 'pistol-squat' }, paused: [] }))
  assert.equal(C.isState({ current: { pistol: 42 }, paused: [] }), false)
})

test('Konfliktregel: wann ersetzt die Server-Fassung die lokale?', async () => {
  const { takeRemote } = await import('../src/client/sync.ts')
  assert.equal(takeRemote(undefined, { updatedAt: 1 }, false), true, 'lokal unbekannt')
  assert.equal(takeRemote({ updatedAt: 9 }, { updatedAt: 1 }, false), true, 'lokal sauber: Server ist maßgeblich')
  assert.equal(takeRemote({ updatedAt: 9 }, { updatedAt: 1 }, true), false, 'lokal ungesendet und jünger: bleibt')
  assert.equal(takeRemote({ updatedAt: 1 }, { updatedAt: 9 }, true), true, 'Server jünger: gewinnt')
})
