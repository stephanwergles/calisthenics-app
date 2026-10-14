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
import { createLimiter } from './rateLimit'

const MAX_DOCS = 2000
/** größer wird ein Sync nie (Erstabgleich mit 2000 Einheiten ≈ 2 MB) – alles darüber ist Missbrauch */
const MAX_BYTES = 8 * 1024 * 1024
/** Die App synchronisiert höchstens alle paar Sekunden – 30 pro Minute ist großzügig */
const limiter = createLimiter(30, 60_000)

export const syncHandler: PayloadHandler = async req => {
  if (!req.user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const key = `u:${req.user.id}`
  if (!limiter.take(key)) {
    return Response.json({ error: 'Zu viele Anfragen – bitte kurz warten' }, { status: 429, headers: { 'Retry-After': String(limiter.retryAfter(key)) } })
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) return Response.json({ error: 'Anfrage zu groß' }, { status: 413 })
  await addDataAndFileToRequest(req)
  const body = (req.data ?? {}) as Partial<C.SyncRequest>
  const { payload } = req
  const user = req.user.id
  const serverTime = new Date().toISOString()
  const rejected: string[] = []
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v.slice(0, MAX_DOCS) : [])
  const mine = (key: string): Where => ({ and: [{ user: { equals: user } }, { key: { equals: key } }] })
  // Alle Zugriffe mit den Rechten der anfragenden Person (die Local API übergeht sie sonst):
  // fremde Nutzerdaten bleiben unsichtbar, Katalog nur lesbar, die Rolle nicht änderbar
  const asUser = { req, overrideAccess: false } as const

  // Katalog-Workouts: Einheiten eigener Workouts haben keine Katalog-Verknüpfung, nur den Plan-Schlüssel
  const catalogWorkouts = new Set((await payload.find({ ...asUser, collection: 'workouts', depth: 0, pagination: false, select: {} }))
    .docs.map(d => String(d.id)))

  /* ── Push ── */
  for (const s of list<C.SyncRequest['sessions'][number]>(body.sessions)) {
    if (!C.isSession(s)) { rejected.push(`Einheit ${String((s as { id?: string })?.id)}: ungültig`); continue }
    try {
      const found = await payload.find({ ...asUser, collection: 'sessions', where: mine(s.id), limit: 1, depth: 0, pagination: false })
      const doc = found.docs[0]
      if (doc && (doc.clientUpdatedAt ?? 0) >= (s.updatedAt ?? 0)) continue
      const data: Record<string, unknown> = C.sessionToDoc(s)
      if (!catalogWorkouts.has(s.workout)) data.workout = null
      if (doc) await payload.update({ ...asUser, collection: 'sessions', id: doc.id, data: data as never, depth: 0 })
      else await payload.create({ ...asUser, collection: 'sessions', data: { ...data, user } as never, depth: 0 })
    } catch (e) { rejected.push(`Einheit ${s.id}: ${(e as Error).message}`) }
  }

  for (const a of list<C.SyncRequest['activities'][number]>(body.activities)) {
    if (!C.isActivity(a)) { rejected.push(`Aktivität ${String((a as { id?: string })?.id)}: ungültig`); continue }
    try {
      const found = await payload.find({ ...asUser, collection: 'activities', where: mine(a.id), limit: 1, depth: 0, pagination: false })
      const doc = found.docs[0]
      if (doc && (doc.clientUpdatedAt ?? 0) >= (a.updatedAt ?? 0)) continue
      const data = C.activityToDoc(a)
      if (doc) await payload.update({ ...asUser, collection: 'activities', id: doc.id, data: data as never, depth: 0 })
      else await payload.create({ ...asUser, collection: 'activities', data: { ...data, user } as never, depth: 0 })
    } catch (e) { rejected.push(`Aktivität ${a.id}: ${(e as Error).message}`) }
  }

  for (const key of list<string>(body.deletedActivities)) {
    if (typeof key !== 'string') continue
    try { await payload.delete({ ...asUser, collection: 'activities', where: mine(key) }) }
    catch (e) { rejected.push(`Löschen ${key}: ${(e as Error).message}`) }
  }

  // eigener Plan: neuere Fassung gewinnt (wie bei Einheiten)
  if (body.plan) {
    if (!C.isPlan(body.plan)) rejected.push('Plan: ungültig')
    else try {
      const found = await payload.find({ ...asUser, collection: 'plans', where: mine(body.plan.id), limit: 1, depth: 0, pagination: false })
      const doc = found.docs[0]
      if (!doc || (doc.clientUpdatedAt ?? 0) < (body.plan.updatedAt ?? 0)) {
        const data = C.planToDoc(body.plan)
        if (doc) await payload.update({ ...asUser, collection: 'plans', id: doc.id, data: data as never, depth: 0 })
        else await payload.create({ ...asUser, collection: 'plans', data: { ...data, user } as never, depth: 0 })
      }
    } catch (e) { rejected.push(`Plan: ${(e as Error).message}`) }
  }

  const me = await payload.findByID({ ...asUser, collection: 'users', id: user, depth: 0 })
  let state = C.docToState((me as { state?: Record<string, unknown> }).state)
  if (body.state) {
    if (!C.isState(body.state)) rejected.push('Trainingsstand: ungültig')
    else if ((body.state.updatedAt ?? 0) > (state.updatedAt ?? 0)) {
      const next = { current: body.state.current, paused: body.state.paused, profile: body.state.profile ?? null, phases: body.state.phases ?? null, challenges: body.state.challenges ?? null, clientUpdatedAt: body.state.updatedAt ?? Date.now() }
      await payload.update({ ...asUser, collection: 'users', id: user, data: { state: next } as never, depth: 0 })
      state = C.docToState(next)
    }
  }

  /* ── Pull ── */
  const since = typeof body.since === 'string' ? body.since : null
  const changed: Where = since ? { and: [{ user: { equals: user } }, { updatedAt: { greater_than: since } }] } : { user: { equals: user } }
  const [sessions, activities] = await Promise.all([
    payload.find({ ...asUser, collection: 'sessions', where: changed, depth: 0, pagination: false }),
    payload.find({ ...asUser, collection: 'activities', where: changed, depth: 0, pagination: false }),
  ])

  // Katalogversion = jüngste Änderung an Übungen, Progressionen, Workouts, Skills, Splits, Wochenplan, Einstufung
  const latest = await Promise.all((['exercises', 'progressions', 'workouts', 'skills', 'splits', 'templates'] as const).map(collection =>
    payload.find({ ...asUser, collection, sort: '-updatedAt', limit: 1, depth: 0 }).then(r => r.docs[0]?.updatedAt ?? '')))
  const [week, assessment] = await Promise.all([
    payload.findGlobal({ ...asUser, slug: 'weekplan', depth: 0 }),
    payload.findGlobal({ ...asUser, slug: 'assessment', depth: 0 }),
  ])
  const catalogVersion = [...latest, week?.updatedAt ?? '', assessment?.updatedAt ?? ''].sort().pop() ?? ''
  let catalog: C.SyncResponse['catalog']
  if (catalogVersion !== body.catalogVersion) {
    const [exs, progs, works, skills, splits, templates] = await Promise.all((['exercises', 'progressions', 'workouts', 'skills', 'splits', 'templates'] as const).map(collection =>
      payload.find({ ...asUser, collection, depth: 0, pagination: false }).then(r => r.docs as unknown as Record<string, unknown>[])))
    catalog = C.buildCatalog(exs, progs, works, week as unknown as Record<string, unknown>,
      { skills, splits, templates, assessment: assessment as unknown as Record<string, unknown> })
  }

  const planDoc = (await payload.find({ ...asUser, collection: 'plans', where: mine('main'), limit: 1, depth: 0, pagination: false })).docs[0]
  const res: C.SyncResponse = {
    plan: planDoc ? C.docToPlan(planDoc as unknown as Record<string, unknown>) : null,
    serverTime, rejected, state, catalogVersion,
    sessions: sessions.docs.map(d => C.docToSession(d as unknown as Record<string, unknown>)),
    activities: activities.docs.map(d => C.docToActivity(d as unknown as Record<string, unknown>)),
    ...(catalog ? { catalog } : {}),
  }
  return Response.json(res)
}
