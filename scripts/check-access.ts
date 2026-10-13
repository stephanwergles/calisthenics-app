/* Rechte gegen die echte Datenbank prüfen (lokal): legt eine Test-Person ohne Admin-Rolle an,
   probiert als sie Katalog ändern, Rolle ändern, fremde Person lesen – und räumt wieder auf.

     npm run check:access */
import { getPayload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { deleteAccountHandler } from '../src/sync/account.ts'

const payload = await getPayload({ config })
const email = `access-check-${Date.now()}@calisthenics.test`
const results: [string, boolean][] = []
const expectDenied = async (name: string, fn: () => Promise<unknown>) => {
  try { await fn(); results.push([name, false]) } catch { results.push([name, true]) }
}

const athlete = await payload.create({ collection: 'users', data: { email, password: crypto.randomUUID() } as never })
try {
  const req = { user: { ...athlete, collection: 'users' } } as unknown as PayloadRequest
  const as = { req, overrideAccess: false } as const
  results.push(['neue Person ist athlete', athlete.role === 'athlete'])

  const ex = await payload.find({ ...as, collection: 'exercises', limit: 1, depth: 0 })
  results.push(['Katalog lesen erlaubt', ex.docs.length === 1])
  const id = ex.docs[0].id
  await expectDenied('Übung ändern verweigert', () => payload.update({ ...as, collection: 'exercises', id, data: { name: 'x' } as never }))
  await expectDenied('Übung löschen verweigert', () => payload.delete({ ...as, collection: 'exercises', id }))
  await expectDenied('Übung anlegen verweigert', () => payload.create({ ...as, collection: 'exercises', data: { id: 'x', name: 'x' } as never }))
  await expectDenied('Wochenplan ändern verweigert', () => payload.updateGlobal({ ...as, slug: 'weekplan', data: {} as never }))

  await payload.update({ ...as, collection: 'users', id: athlete.id, data: { role: 'admin' } as never }).catch(() => undefined)
  const after = await payload.findByID({ collection: 'users', id: athlete.id, depth: 0 })
  results.push(['sich selbst zum Admin machen wirkungslos', after.role === 'athlete'])

  const others = await payload.find({ ...as, collection: 'users', depth: 0, pagination: false })
  results.push(['sieht nur sich selbst', others.docs.length === 1 && others.docs[0].id === athlete.id])
  await expectDenied('Person anlegen verweigert', () => payload.create({ ...as, collection: 'users', data: { email: `x${email}`, password: 'x'.repeat(12) } as never }))

  // was der Sync-Endpunkt mit den Rechten der Person tut, muss weiter gehen
  const w = await payload.find({ ...as, collection: 'workouts', limit: 1, depth: 0 })
  const key = `2026-01-01-${w.docs[0].id}`
  const sess = await payload.create({ ...as, collection: 'sessions', data: { key, date: '2026-01-01', workout: w.docs[0].id, user: athlete.id, sets: [] } as never, depth: 0 })
  results.push(['Sync: eigene Einheit anlegen', sess.user === athlete.id || (sess.user as { id?: unknown })?.id === athlete.id])
  await payload.update({ ...as, collection: 'sessions', id: sess.id, data: { note: 'x' } as never })
  results.push(['Sync: eigene Einheit ändern', true])
  const mine = await payload.find({ ...as, collection: 'sessions', depth: 0, pagination: false })
  results.push(['Sync: sieht nur eigene Einheiten', mine.docs.every(d => d.user === athlete.id)])
  await payload.update({ ...as, collection: 'users', id: athlete.id, data: { state: { current: {}, paused: [], clientUpdatedAt: 1 } } as never })
  results.push(['Sync: eigenen Trainingsstand speichern', true])
  const cat = await Promise.all((['exercises', 'progressions', 'workouts'] as const).map(c => payload.find({ ...as, collection: c, depth: 0, pagination: false })))
  results.push(['Sync: ganzer Katalog lesbar', cat.every(r => r.docs.length > 0)])
  await payload.findGlobal({ ...as, slug: 'weekplan', depth: 0 })
  results.push(['Sync: Wochenplan lesbar', true])
  await payload.delete({ collection: 'sessions', id: sess.id })

  const panel = payload.collections.users.config.access.admin
  results.push(['Admin-Panel verweigert', !(await panel?.({ req } as never))])
} finally {
  await payload.delete({ collection: 'users', id: athlete.id })
}

// Konto löschen: eigene Daten weg, fremde bleiben
{
  const mk = (tag: string) => payload.create({ collection: 'users', data: { email: `del-${tag}-${email}`, password: crypto.randomUUID() } as never })
  const [gone, other] = [await mk('a'), await mk('b')]
  const w = (await payload.find({ collection: 'workouts', limit: 1, depth: 0 })).docs[0].id
  for (const u of [gone, other]) {
    await payload.create({ collection: 'sessions', data: { key: `2026-01-02-${w}`, date: '2026-01-02', workout: w, user: u.id, sets: [] } as never })
    await payload.create({ collection: 'activities', data: { key: `2026-01-02-run-${u.id}`, date: '2026-01-02', kind: 'run', user: u.id } as never })
  }
  const res = await deleteAccountHandler({ payload, user: { ...gone, collection: 'users' } } as never)
  const count = async (c: 'sessions' | 'activities', u: number | string) => (await payload.count({ collection: c, where: { user: { equals: u } } })).totalDocs
  results.push(['Konto löschen: Antwort ok', res.status === 200])
  results.push(['Konto löschen: Person weg', (await payload.count({ collection: 'users', where: { id: { equals: gone.id } } })).totalDocs === 0])
  results.push(['Konto löschen: eigene Einheiten/Aktivitäten weg', (await count('sessions', gone.id)) + (await count('activities', gone.id)) === 0])
  results.push(['Konto löschen: fremde Daten bleiben', (await count('sessions', other.id)) === 1 && (await count('activities', other.id)) === 1])
  await payload.delete({ collection: 'sessions', where: { user: { equals: other.id } } })
  await payload.delete({ collection: 'activities', where: { user: { equals: other.id } } })
  await payload.delete({ collection: 'users', id: other.id })
}

for (const [name, ok] of results) console.log(`${ok ? '✓' : '✗'} ${name}`)
const failed = results.filter(([, ok]) => !ok).length
console.log(failed ? `${failed} Prüfung(en) fehlgeschlagen` : 'Alle Rechte-Prüfungen bestanden')
process.exit(failed ? 1 : 0)
