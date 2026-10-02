/* POST /api/sync – Abgleich zwischen Gerät und Server.

   1. Push: Das Gerät schickt geänderte Einheiten, Aktivitäten, gelöschte
      Aktivitäten und den Trainingsstand. Pro Dokument gewinnt die jüngere Fassung
      (clientUpdatedAt). Ungültige Dokumente werden gemeldet, nicht abgelehnt.
   2. Pull: Der Server liefert alles, was sich seit `since` geändert hat, den
      Trainingsstand und – wenn sich der Katalog geändert hat – den Katalog.

   `serverTime` wird VOR dem Schreiben genommen: Lieber kommt ein Dokument beim
   nächsten Sync doppelt zurück, als dass eine parallele Änderung verloren geht. */
import { addDataAndFileToRequest, type PayloadHandler, type Where } from 'payload'
import * as C from './convert'

const MAX_DOCS = 2000

export const syncHandler: PayloadHandler = async req => {
  if (!req.user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  await addDataAndFileToRequest(req)
  const body = (req.data ?? {}) as Partial<C.SyncRequest>
  const { payload } = req
  const user = req.user.id
  const serverTime = new Date().toISOString()
  const rejected: string[] = []
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v.slice(0, MAX_DOCS) : [])
  const mine = (key: string): Where => ({ and: [{ user: { equals: user } }, { key: { equals: key } }] })

  /* ── Push ── */
  for (const s of list<C.SyncRequest['sessions'][number]>(body.sessions)) {
    if (!C.isSession(s)) { rejected.push(`Einheit ${String((s as { id?: string })?.id)}: ungültig`); continue }
    try {
      const found = await payload.find({ collection: 'sessions', where: mine(s.id), limit: 1, depth: 0, pagination: false })
      const doc = found.docs[0]
      if (doc && (doc.clientUpdatedAt ?? 0) >= (s.updatedAt ?? 0)) continue
      const data = C.sessionToDoc(s)
      if (doc) await payload.update({ collection: 'sessions', id: doc.id, data: data as never, depth: 0 })
      else await payload.create({ collection: 'sessions', data: { ...data, user } as never, depth: 0 })
    } catch (e) { rejected.push(`Einheit ${s.id}: ${(e as Error).message}`) }
  }

  for (const a of list<C.SyncRequest['activities'][number]>(body.activities)) {
    if (!C.isActivity(a)) { rejected.push(`Aktivität ${String((a as { id?: string })?.id)}: ungültig`); continue }
    try {
      const found = await payload.find({ collection: 'activities', where: mine(a.id), limit: 1, depth: 0, pagination: false })
      const doc = found.docs[0]
      if (doc && (doc.clientUpdatedAt ?? 0) >= (a.updatedAt ?? 0)) continue
      const data = C.activityToDoc(a)
      if (doc) await payload.update({ collection: 'activities', id: doc.id, data: data as never, depth: 0 })
      else await payload.create({ collection: 'activities', data: { ...data, user } as never, depth: 0 })
    } catch (e) { rejected.push(`Aktivität ${a.id}: ${(e as Error).message}`) }
  }

  for (const key of list<string>(body.deletedActivities)) {
    if (typeof key !== 'string') continue
    try { await payload.delete({ collection: 'activities', where: mine(key) }) }
    catch (e) { rejected.push(`Löschen ${key}: ${(e as Error).message}`) }
  }

  const me = await payload.findByID({ collection: 'users', id: user, depth: 0 })
  let state = C.docToState((me as { state?: Record<string, unknown> }).state)
  if (body.state) {
    if (!C.isState(body.state)) rejected.push('Trainingsstand: ungültig')
    else if ((body.state.updatedAt ?? 0) > (state.updatedAt ?? 0)) {
      const next = { current: body.state.current, paused: body.state.paused, clientUpdatedAt: body.state.updatedAt ?? Date.now() }
      await payload.update({ collection: 'users', id: user, data: { state: next } as never, depth: 0 })
      state = C.docToState(next)
    }
  }

  /* ── Pull ── */
  const since = typeof body.since === 'string' ? body.since : null
  const changed: Where = since ? { and: [{ user: { equals: user } }, { updatedAt: { greater_than: since } }] } : { user: { equals: user } }
  const [sessions, activities] = await Promise.all([
    payload.find({ collection: 'sessions', where: changed, depth: 0, pagination: false }),
    payload.find({ collection: 'activities', where: changed, depth: 0, pagination: false }),
  ])

  // Katalogversion = jüngste Änderung an Übungen, Progressionen, Workouts, Wochenplan
  const latest = await Promise.all((['exercises', 'progressions', 'workouts'] as const).map(collection =>
    payload.find({ collection, sort: '-updatedAt', limit: 1, depth: 0 }).then(r => r.docs[0]?.updatedAt ?? '')))
  const week = await payload.findGlobal({ slug: 'weekplan', depth: 0 })
  const catalogVersion = [...latest, week?.updatedAt ?? ''].sort().pop() ?? ''
  let catalog: C.SyncResponse['catalog']
  if (catalogVersion !== body.catalogVersion) {
    const [exs, progs, works] = await Promise.all((['exercises', 'progressions', 'workouts'] as const).map(collection =>
      payload.find({ collection, depth: 0, pagination: false }).then(r => r.docs as unknown as Record<string, unknown>[])))
    catalog = C.buildCatalog(exs, progs, works, week as unknown as Record<string, unknown>)
  }

  const res: C.SyncResponse = {
    serverTime, rejected, state, catalogVersion,
    sessions: sessions.docs.map(d => C.docToSession(d as unknown as Record<string, unknown>)),
    activities: activities.docs.map(d => C.docToActivity(d as unknown as Record<string, unknown>)),
    ...(catalog ? { catalog } : {}),
  }
  return Response.json(res)
}
