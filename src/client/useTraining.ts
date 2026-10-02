'use client'
/* Zustand der Trainings-App: lädt aus IndexedDB, hält alles im Speicher und
   schreibt jede Änderung sofort zurück. Der Katalog kommt bis zum Sync aus dem
   Build (src/seed/catalog.json) – damit ist er auch beim ersten Start offline da. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import catalogJson from '@/seed/catalog.json'
import positionsJson from '@/migrate/v1-positions.json'
import type { Activity, Catalog, Dataset, Session, UserState, WorkoutId } from '@/domain/model'
import { migrate, type V1Positions } from '@/migrate/core'
import * as db from './db'
import * as L from './logic'

export const catalog = catalogJson as unknown as Catalog
export const ix = L.indexCatalog(catalog)

export interface ActiveSession { start: number; workout: WorkoutId }
const EMPTY_STATE: UserState = { current: {}, paused: [] }

export function useTraining() {
  const [loaded, setLoaded] = useState(false)
  const [persistent, setPersistent] = useState(true)
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [activities, setActivities] = useState<Activity[]>([])
  const [state, setStateRaw] = useState<UserState>(EMPTY_STATE)
  const [active, setActive] = useState<ActiveSession | null>(null)
  const [choice, setChoice] = useState<{ date: string; workout: WorkoutId } | null>(null)
  const [today, setToday] = useState(L.localDate())

  useEffect(() => {
    void (async () => {
      const [ss, as, st, ac, ch, ok] = await Promise.all([
        db.getAll<Session>('sessions'), db.getAll<Activity>('activities'),
        db.kvGet<UserState>('state'), db.kvGet<ActiveSession>('active'),
        db.kvGet<{ date: string; workout: WorkoutId }>('choice'), db.persistent(),
      ])
      setSessions(new Map(ss.map(s => [s.id, s])))
      setActivities(as)
      setStateRaw(st ?? EMPTY_STATE)
      setActive(ac ?? null)
      setChoice(ch ?? null)
      setPersistent(ok)
      setLoaded(true)
    })()
    // Tageswechsel um Mitternacht und nach dem Aufwachen aus dem Hintergrund
    const tick = () => setToday(L.localDate())
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

  const sessionList = useMemo(() => [...sessions.values()], [sessions])

  /** Workout von heute: ausdrückliche Wahl > bereits begonnene Einheit > Empfehlung */
  const recommended = useMemo(() => L.recommendWorkout(ix, sessionList, today), [sessionList, today])
  const workout: WorkoutId = useMemo(() => {
    if (choice?.date === today) return choice.workout
    const started = sessionList.filter(s => s.date === today && s.sets.length)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
    return active?.workout ?? started?.workout ?? recommended
  }, [choice, today, sessionList, active, recommended])

  const todaySession = sessions.get(L.sessionId(today, workout))

  const saveSession = useCallback((s: Session) => {
    setSessions(prev => new Map(prev).set(s.id, s))
    void db.put('sessions', s)
  }, [])

  /** Ändert die heutige Einheit des aktuellen Workouts (legt sie bei Bedarf an) */
  const updateToday = useCallback((fn: (s: Session) => Session) => {
    const id = L.sessionId(today, workout)
    setSessions(prev => {
      const next = fn(prev.get(id) ?? L.emptySession(today, workout))
      void db.put('sessions', next)
      return new Map(prev).set(id, next)
    })
  }, [today, workout])

  const setState = useCallback((fn: (s: UserState) => UserState) => {
    setStateRaw(prev => { const next = fn(prev); void db.kvSet('state', next); return next })
  }, [])

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
      setSessions(prev => {
        const next = L.withDuration(prev.get(id) ?? L.emptySession(date, active.workout), seconds)
        void db.put('sessions', next)
        return new Map(prev).set(id, next)
      })
    }
    setActive(null); void db.kvSet('active', undefined)
  }, [active])

  const addActivity = useCallback((a: Activity) => {
    setActivities(prev => [...prev.filter(x => x.id !== a.id), a]); void db.put('activities', a)
  }, [])
  const removeActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(x => x.id !== id)); void db.remove('activities', id)
  }, [])

  /** v1-Export übernehmen: gleiche Einheiten (datum-workout) werden ersetzt, andere bleiben */
  const importV1 = useCallback(async (v1: unknown) => {
    const { data, warnings, dropped } = migrate(v1, catalog, positionsJson as V1Positions)
    for (const s of data.sessions) await db.put('sessions', s)
    for (const a of data.activities) await db.put('activities', a)
    await db.kvSet('state', data.state)
    setSessions(prev => { const m = new Map(prev); data.sessions.forEach(s => m.set(s.id, s)); return m })
    setActivities(prev => [...prev.filter(a => !data.activities.some(b => b.id === a.id)), ...data.activities])
    setStateRaw(data.state)
    return { sessions: data.sessions.length, sets: data.sessions.reduce((n, s) => n + s.sets.length, 0), activities: data.activities.length, warnings, dropped }
  }, [])

  const exportData = useCallback((): Dataset => ({
    schema: 1,
    source: { app: 'v1', exportVersion: null, exportedAt: new Date().toISOString() },
    sessions: [...sessionList].sort((a, b) => (a.id < b.id ? -1 : 1)),
    activities: [...activities].sort((a, b) => (a.id < b.id ? -1 : 1)),
    state,
  }), [sessionList, activities, state])

  return {
    loaded, persistent, today, sessions: sessionList, activities, state, active, workout, recommended,
    todaySession, saveSession, updateToday, setState, chooseWorkout, startSession, endSession,
    addActivity, removeActivity, importV1, exportData,
  }
}
export type Training = ReturnType<typeof useTraining>
