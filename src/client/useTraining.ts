'use client'
/* Zustand der Trainings-App. Lesen und Schreiben ausschließlich lokal (IndexedDB),
   der Abgleich mit dem Server läuft im Hintergrund:
   - jede Änderung landet im Postausgang (outbox) und löst nach kurzer Pause einen Sync aus
   - außerdem beim Start, wenn das Netz zurückkommt und wenn die App wieder sichtbar wird
   - der erste Sync nach der Anmeldung lädt alles hoch
   Der Katalog kommt vom Server, sobald er einmal geladen wurde; bis dahin aus dem Build. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import catalogJson from '@/seed/catalog.json'
import positionsJson from '@/migrate/v1-positions.json'
import type { Activity, Catalog, Dataset, Session, UserState, WorkoutId } from '@/domain/model'
import { migrate, type V1Positions } from '@/migrate/core'
import { catalogUsable } from '@/sync/convert'
import * as db from './db'
import * as L from './logic'
import * as api from './sync'

/** Katalog aus dem Build – Fallback und Grundlage für den v1-Import (dessen Positionen auf diese IDs zeigen) */
export const bundledCatalog = catalogJson as unknown as Catalog

export interface ActiveSession { start: number; workout: WorkoutId }
export interface SyncStatus {
  account: { email: string } | null | undefined   // undefined = noch unbekannt (z. B. offline gestartet)
  phase: 'idle' | 'syncing' | 'error' | 'offline'
  lastSync: string | null
  pending: number
  error?: string
}
const EMPTY_STATE: UserState = { current: {}, paused: [] }
const SYNC_DELAY = 2500

export function useTraining() {
  const [loaded, setLoaded] = useState(false)
  const [persistent, setPersistent] = useState(true)
  const [catalog, setCatalog] = useState<Catalog>(bundledCatalog)
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [activities, setActivities] = useState<Activity[]>([])
  const [state, setStateRaw] = useState<UserState>(EMPTY_STATE)
  const [active, setActive] = useState<ActiveSession | null>(null)
  const [choice, setChoice] = useState<{ date: string; workout: WorkoutId } | null>(null)
  const [today, setToday] = useState(L.localDate())
  const [sync, setSync] = useState<SyncStatus>({ account: undefined, phase: 'idle', lastSync: null, pending: 0 })

  const ix = useMemo(() => L.indexCatalog(catalog), [catalog])

  // Refs: der Sync arbeitet asynchron und braucht immer den aktuellen Stand
  const sessionsRef = useRef(sessions); sessionsRef.current = sessions
  const activitiesRef = useRef(activities); activitiesRef.current = activities
  const stateRef = useRef(state); stateRef.current = state
  const outbox = useRef<api.Outbox>({ ...api.EMPTY_OUTBOX })
  const meta = useRef<{ lastSync: string | null; catalogVersion: string | null; account: { email: string } | null | undefined }>({ lastSync: null, catalogVersion: null, account: undefined })
  const running = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Sync ─────────────────────────────────────────────────────────────── */

  const saveOutbox = () => {
    void db.kvSet('outbox', outbox.current)
    setSync(s => ({ ...s, pending: api.pendingCount(outbox.current) }))
  }

  const runSync = useCallback(async () => {
    if (running.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setSync(s => ({ ...s, phase: 'offline' })); return }
    if (!meta.current.account) return
    running.current = true
    setSync(s => ({ ...s, phase: 'syncing', error: undefined }))
    try {
      const ob = outbox.current, first = !meta.current.lastSync
      const sessionsOut = first ? [...sessionsRef.current.values()]
        : ob.sessions.map(id => sessionsRef.current.get(id)).filter((s): s is Session => !!s)
      const activitiesOut = first ? activitiesRef.current
        : ob.activities.map(id => activitiesRef.current.find(a => a.id === id)).filter((a): a is Activity => !!a)
      const sentAt = new Map<string, number | undefined>([
        ...sessionsOut.map(s => [`s:${s.id}`, s.updatedAt] as const),
        ...activitiesOut.map(a => [`a:${a.id}`, a.updatedAt] as const),
      ])
      const stateSentAt = stateRef.current.updatedAt
      const res = await api.postSync({
        since: meta.current.lastSync, catalogVersion: meta.current.catalogVersion,
        sessions: sessionsOut, activities: activitiesOut,
        deletedActivities: ob.deletedActivities, state: first || ob.state ? stateRef.current : null,
      })

      // Postausgang leeren – außer was sich während des Syncs schon wieder geändert hat
      outbox.current = {
        sessions: ob.sessions.filter(id => sessionsRef.current.get(id)?.updatedAt !== sentAt.get(`s:${id}`)),
        activities: ob.activities.filter(id => activitiesRef.current.find(a => a.id === id)?.updatedAt !== sentAt.get(`a:${id}`)),
        deletedActivities: outbox.current.deletedActivities.filter(id => !ob.deletedActivities.includes(id)),
        state: outbox.current.state && stateRef.current.updatedAt !== stateSentAt,
      }

      // Server-Stand einarbeiten
      const dirtyS = new Set(outbox.current.sessions), dirtyA = new Set(outbox.current.activities)
      const takeS = res.sessions.filter(r => api.takeRemote(sessionsRef.current.get(r.id), r, dirtyS.has(r.id)))
      if (takeS.length) {
        for (const s of takeS) await db.put('sessions', s)
        setSessions(prev => { const m = new Map(prev); takeS.forEach(s => m.set(s.id, s)); return m })
      }
      const takeA = res.activities.filter(r => !outbox.current.deletedActivities.includes(r.id)
        && api.takeRemote(activitiesRef.current.find(a => a.id === r.id), r, dirtyA.has(r.id)))
      if (takeA.length) {
        for (const a of takeA) await db.put('activities', a)
        setActivities(prev => [...prev.filter(a => !takeA.some(b => b.id === a.id)), ...takeA])
      }
      if (api.takeRemote(stateRef.current, res.state, outbox.current.state) && (res.state.updatedAt ?? 0) > 0) {
        setStateRaw(res.state); void db.kvSet('state', res.state)
      }
      if (res.catalog && catalogUsable(res.catalog)) {
        setCatalog(res.catalog); void db.kvSet('catalog', res.catalog)
      }
      meta.current.catalogVersion = res.catalogVersion
      meta.current.lastSync = res.serverTime
      void db.kvSet('meta', { lastSync: res.serverTime, catalogVersion: res.catalogVersion })
      saveOutbox()
      setSync(s => ({ ...s, phase: 'idle', lastSync: res.serverTime, error: res.rejected.length ? res.rejected.join(' · ') : undefined }))
    } catch (e) {
      if (e instanceof api.AuthError) {
        meta.current.account = null; void db.kvSet('account', null)
        setSync(s => ({ ...s, account: null, phase: 'idle' }))
      } else {
        setSync(s => ({ ...s, phase: navigator.onLine ? 'error' : 'offline', error: (e as Error).message }))
      }
    } finally {
      running.current = false
      // Änderungen während des Syncs → gleich noch eine Runde
      if (api.pendingCount(outbox.current) && meta.current.account) schedule()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = useCallback((delay = SYNC_DELAY) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void runSync(), delay)
  }, [runSync])

  const markDirty = useCallback((kind: 'sessions' | 'activities' | 'deletedActivities' | 'state', id?: string) => {
    const o = outbox.current
    if (kind === 'state') o.state = true
    else if (id && !o[kind].includes(id)) o[kind] = [...o[kind], id]
    if (kind === 'deletedActivities' && id) o.activities = o.activities.filter(x => x !== id)
    saveOutbox()
    if (meta.current.account) schedule()
  }, [schedule])

  /* ── Laden ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    void (async () => {
      const [ss, as, st, ac, ch, ok, cat, ob, m, acct] = await Promise.all([
        db.getAll<Session>('sessions'), db.getAll<Activity>('activities'),
        db.kvGet<UserState>('state'), db.kvGet<ActiveSession>('active'),
        db.kvGet<{ date: string; workout: WorkoutId }>('choice'), db.persistent(),
        db.kvGet<Catalog>('catalog'), db.kvGet<api.Outbox>('outbox'),
        db.kvGet<{ lastSync: string | null; catalogVersion: string | null }>('meta'),
        db.kvGet<{ email: string } | null>('account'),
      ])
      setSessions(new Map(ss.map(s => [s.id, s])))
      setActivities(as)
      setStateRaw(st ?? EMPTY_STATE)
      setActive(ac ?? null)
      setChoice(ch ?? null)
      setPersistent(ok)
      if (catalogUsable(cat)) setCatalog(cat)
      outbox.current = { ...api.EMPTY_OUTBOX, ...ob }
      meta.current = { lastSync: m?.lastSync ?? null, catalogVersion: m?.catalogVersion ?? null, account: acct ?? undefined }
      setSync({ account: acct ?? undefined, phase: navigator.onLine ? 'idle' : 'offline', lastSync: m?.lastSync ?? null, pending: api.pendingCount(outbox.current) })
      setLoaded(true)

      // Anmeldung prüfen und Sitzung verlängern, dann abgleichen
      if (navigator.onLine) {
        try {
          const who = await api.me()
          meta.current.account = who; void db.kvSet('account', who)
          setSync(s => ({ ...s, account: who }))
          if (who) { await api.refresh(); void runSync() }
        } catch { /* Server nicht erreichbar – später erneut */ }
      }
    })()

    const tick = () => setToday(L.localDate())
    const id = setInterval(tick, 60_000)
    const onVisible = () => { tick(); if (!document.hidden && meta.current.account) schedule(500) }
    const onOnline = () => { setSync(s => ({ ...s, phase: 'idle' })); if (meta.current.account) schedule(500) }
    const onOffline = () => setSync(s => ({ ...s, phase: 'offline' }))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Abgeleitet ───────────────────────────────────────────────────────── */

  const sessionList = useMemo(() => [...sessions.values()], [sessions])
  const recommended = useMemo(() => L.recommendWorkout(ix, sessionList, today), [ix, sessionList, today])
  /** Workout von heute: ausdrückliche Wahl > laufende/begonnene Einheit > Empfehlung */
  const workout: WorkoutId = useMemo(() => {
    const known = (w?: WorkoutId) => (w && ix.workouts.has(w) ? w : undefined)
    if (choice?.date === today && known(choice.workout)) return choice.workout
    const started = sessionList.filter(s => s.date === today && s.sets.length)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
    return known(active?.workout) ?? known(started?.workout) ?? recommended
  }, [ix, choice, today, sessionList, active, recommended])
  const todaySession = sessions.get(L.sessionId(today, workout))

  /* ── Ändern (immer lokal + Postausgang) ───────────────────────────────── */

  const putSession = useCallback((s: Session) => {
    setSessions(prev => new Map(prev).set(s.id, s))
    void db.put('sessions', s)
    markDirty('sessions', s.id)
  }, [markDirty])

  const updateToday = useCallback((fn: (s: Session) => Session) => {
    const id = L.sessionId(today, workout)
    putSession(fn(sessionsRef.current.get(id) ?? L.emptySession(today, workout)))
  }, [today, workout, putSession])

  const setState = useCallback((fn: (s: UserState) => UserState) => {
    const next = { ...fn(stateRef.current), updatedAt: Date.now() }
    setStateRaw(next); void db.kvSet('state', next)
    markDirty('state')
  }, [markDirty])

  const chooseWorkout = useCallback((w: WorkoutId) => {
    const c = { date: today, workout: w }
    setChoice(c); void db.kvSet('choice', c)
  }, [today])

  const startSession = useCallback(() => {
    if (active) return
    const a = { start: Date.now(), workout }
    setActive(a); void db.kvSet('active', a)
  }, [active, workout])

  /** Beenden: Dauer ab 60 s wird der Einheit gutgeschrieben (mehrere pro Tag summieren sich) */
  const endSession = useCallback(() => {
    if (!active) return
    const seconds = (Date.now() - active.start) / 1000
    if (seconds >= 60) {
      const date = L.localDate(new Date(active.start)), id = L.sessionId(date, active.workout)
      putSession(L.withDuration(sessionsRef.current.get(id) ?? L.emptySession(date, active.workout), seconds))
    }
    setActive(null); void db.kvSet('active', undefined)
  }, [active, putSession])

  const addActivity = useCallback((a: Activity) => {
    const next = { ...a, updatedAt: Date.now() }
    setActivities(prev => [...prev.filter(x => x.id !== next.id), next]); void db.put('activities', next)
    markDirty('activities', next.id)
  }, [markDirty])
  const removeActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(x => x.id !== id)); void db.remove('activities', id)
    markDirty('deletedActivities', id)
  }, [markDirty])

  /** v1-Export übernehmen: gleiche Einheiten (datum-workout) werden ersetzt, andere bleiben */
  const importV1 = useCallback(async (v1: unknown) => {
    const { data, warnings, dropped } = migrate(v1, bundledCatalog, positionsJson as V1Positions)
    const now = Date.now()
    const sessionsIn = data.sessions.map(s => ({ ...s, updatedAt: now }))
    const activitiesIn = data.activities.map(a => ({ ...a, updatedAt: now }))
    const stateIn = { ...data.state, updatedAt: now }
    for (const s of sessionsIn) await db.put('sessions', s)
    for (const a of activitiesIn) await db.put('activities', a)
    await db.kvSet('state', stateIn)
    setSessions(prev => { const m = new Map(prev); sessionsIn.forEach(s => m.set(s.id, s)); return m })
    setActivities(prev => [...prev.filter(a => !activitiesIn.some(b => b.id === a.id)), ...activitiesIn])
    setStateRaw(stateIn)
    outbox.current = {
      ...outbox.current,
      sessions: [...new Set([...outbox.current.sessions, ...sessionsIn.map(s => s.id)])],
      activities: [...new Set([...outbox.current.activities, ...activitiesIn.map(a => a.id)])],
      state: true,
    }
    saveOutbox()
    if (meta.current.account) schedule(500)
    return { sessions: sessionsIn.length, sets: sessionsIn.reduce((n, s) => n + s.sets.length, 0), activities: activitiesIn.length, warnings, dropped }
  }, [schedule]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportData = useCallback((): Dataset => ({
    schema: 1,
    source: { app: 'v1', exportVersion: null, exportedAt: new Date().toISOString() },
    sessions: [...sessionList].sort((a, b) => (a.id < b.id ? -1 : 1)),
    activities: [...activities].sort((a, b) => (a.id < b.id ? -1 : 1)),
    state,
  }), [sessionList, activities, state])

  /* ── Konto ────────────────────────────────────────────────────────────── */

  const signIn = useCallback(async (email: string, password: string) => {
    const who = await api.login(email, password)
    meta.current.account = who; void db.kvSet('account', who)
    setSync(s => ({ ...s, account: who }))
    await runSync()
  }, [runSync])

  const signOut = useCallback(async () => {
    await api.logout()
    // nächste Anmeldung (evtl. anderes Konto) lädt wieder alles hoch
    meta.current = { ...meta.current, account: null, lastSync: null }
    void db.kvSet('account', null)
    void db.kvSet('meta', { lastSync: null, catalogVersion: meta.current.catalogVersion })
    setSync(s => ({ ...s, account: null }))
  }, [])

  return {
    loaded, persistent, today, ix, sessions: sessionList, activities, state, active, workout, recommended,
    todaySession, updateToday, setState, chooseWorkout, startSession, endSession,
    addActivity, removeActivity, importV1, exportData,
    sync, syncNow: runSync, signIn, signOut,
  }
}
export type Training = ReturnType<typeof useTraining>
