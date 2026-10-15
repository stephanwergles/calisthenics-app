'use client'
/* Zustand der Trainings-App. Lesen und Schreiben ausschließlich lokal (IndexedDB),
   der Abgleich mit dem Server läuft im Hintergrund:
   - jede Änderung landet im Postausgang (outbox) und löst nach kurzer Pause einen Sync aus
   - außerdem beim Start, wenn das Netz zurückkommt und wenn die App wieder sichtbar wird
   - der erste Sync nach der Anmeldung lädt alles hoch
   Der Katalog kommt vom Server, sobald er einmal geladen wurde; bis dahin aus dem Build. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import catalogJson from '../seed/catalog.json'
import positionsJson from '../migrate/v1-positions.json'
import type { Activity, Catalog, Dataset, Plan, Session, UserState, WorkoutId } from '../domain/model.ts'
import { migrate, type V1Positions } from '../migrate/core.ts'
import { catalogUsable } from '../sync/convert.ts'
import * as L from './logic.ts'
import * as api from './api.ts'
import { DISCLAIMER_VERSION, HEALTH_CONSENT_VERSION } from './consent.ts'
import { platform } from './platform.ts'

const db = { get: () => platform().db }

/** Katalog aus dem Build – Fallback und Grundlage für den v1-Import (dessen Positionen auf diese IDs zeigen) */
export const bundledCatalog = catalogJson as unknown as Catalog

export interface ActiveSession { start: number; workout: WorkoutId
  /** Einheit, in die diese Session schreibt (fehlt bei älteren Ständen: Datum + Workout) */
  id?: string
  /** Stand der Einheit beim Start – „Abbrechen“ stellt ihn wieder her (lokal, wird nicht synchronisiert) */
  before?: Session }
/** Einheit der laufenden Session */
export const activeSessionId = (a: ActiveSession) => a.id ?? L.sessionId(L.localDate(new Date(a.start)), a.workout)
export interface SyncStatus {
  account: api.Who | null | undefined   // undefined = noch unbekannt (z. B. offline gestartet)
  /** angemeldet, aber ohne Einwilligung in die Gesundheitsdaten – Abgleich pausiert */
  consentMissing?: boolean
  phase: 'idle' | 'syncing' | 'error' | 'offline'
  lastSync: string | null
  pending: number
  error?: string
}
const EMPTY_STATE: UserState = { current: {}, paused: [] }
const SYNC_DELAY = 2500

/** Abmelden abgebrochen: es gibt noch nicht abgeglichene Änderungen (offline oder Serverfehler) */
export class UnsyncedError extends Error {
  constructor(readonly pending: number) { super(`${pending} Änderungen noch nicht abgeglichen`) }
}

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

  // eigener Plan (null = Katalog-Plan, also der bisherige Plan unverändert)
  const [plan, setPlanRaw] = useState<Plan | null>(null)
  const planRef = useRef(plan); planRef.current = plan
  const ix = useMemo(() => L.indexCatalog(L.effectiveCatalog(catalog, plan)), [catalog, plan])

  // Refs: der Sync arbeitet asynchron und braucht immer den aktuellen Stand
  const sessionsRef = useRef(sessions); sessionsRef.current = sessions
  const activitiesRef = useRef(activities); activitiesRef.current = activities
  const stateRef = useRef(state); stateRef.current = state
  const outbox = useRef<api.Outbox>({ ...api.EMPTY_OUTBOX })
  const meta = useRef<{ lastSync: string | null; catalogVersion: string | null; account: api.Who | null | undefined }>({ lastSync: null, catalogVersion: null, account: undefined })
  // Einwilligungen (lokal): Gesundheitsdaten-Version für den Abgleich, Hinweis beim ersten Start
  const [consent, setConsentRaw] = useState<{ health: string | null; disclaimer: string | null }>({ health: null, disclaimer: null })
  const consentRef = useRef(consent); consentRef.current = consent
  const setConsent = (c: { health: string | null; disclaimer: string | null }) => { consentRef.current = c; setConsentRaw(c); void db.get().kvSet('consent', c) }
  const running = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Sync ─────────────────────────────────────────────────────────────── */

  const saveOutbox = () => {
    void db.get().kvSet('outbox', outbox.current)
    setSync(s => ({ ...s, pending: api.pendingCount(outbox.current) }))
  }

  /** Ergebnis für Rückmeldungen beim manuellen Abgleich (Toast); automatische Läufe ignorieren es */
  const runSync = useCallback(async (): Promise<'ok' | 'error' | 'skipped'> => {
    if (running.current) return 'skipped'
    if (!platform().online()) { setSync(s => ({ ...s, phase: 'offline' })); return 'error' }
    if (!meta.current.account) return 'skipped'
    // ohne Einwilligung keine Gesundheitsdaten auf den Server (Art. 9 DSGVO)
    if (consentRef.current.health !== HEALTH_CONSENT_VERSION) { setSync(s => ({ ...s, phase: 'idle', consentMissing: true })); return 'skipped' }
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
      const planSentAt = planRef.current?.updatedAt
      const stateSentAt = stateRef.current.updatedAt
      const res = await api.postSync({
        since: meta.current.lastSync, catalogVersion: meta.current.catalogVersion,
        sessions: sessionsOut, activities: activitiesOut,
        deletedActivities: ob.deletedActivities, state: first || ob.state ? stateRef.current : null,
        ...((first || ob.plan) && planRef.current ? { plan: planRef.current } : {}),
      })

      // Postausgang leeren – außer was sich während des Syncs schon wieder geändert hat
      outbox.current = {
        sessions: ob.sessions.filter(id => sessionsRef.current.get(id)?.updatedAt !== sentAt.get(`s:${id}`)),
        activities: ob.activities.filter(id => activitiesRef.current.find(a => a.id === id)?.updatedAt !== sentAt.get(`a:${id}`)),
        deletedActivities: outbox.current.deletedActivities.filter(id => !ob.deletedActivities.includes(id)),
        state: outbox.current.state && stateRef.current.updatedAt !== stateSentAt,
        plan: !!outbox.current.plan && planRef.current?.updatedAt !== planSentAt,
      }

      // Server-Stand einarbeiten
      const dirtyS = new Set(outbox.current.sessions), dirtyA = new Set(outbox.current.activities)
      const takeS = res.sessions.filter(r => api.takeRemote(sessionsRef.current.get(r.id), r, dirtyS.has(r.id)))
      if (takeS.length) {
        for (const s of takeS) await db.get().put('sessions', s)
        setSessions(prev => { const m = new Map(prev); takeS.forEach(s => m.set(s.id, s)); return m })
      }
      const takeA = res.activities.filter(r => !outbox.current.deletedActivities.includes(r.id)
        && api.takeRemote(activitiesRef.current.find(a => a.id === r.id), r, dirtyA.has(r.id)))
      if (takeA.length) {
        for (const a of takeA) await db.get().put('activities', a)
        setActivities(prev => [...prev.filter(a => !takeA.some(b => b.id === a.id)), ...takeA])
      }
      if (api.takeRemote(stateRef.current, res.state, outbox.current.state) && (res.state.updatedAt ?? 0) > 0) {
        setStateRaw(res.state); void db.get().kvSet('state', res.state)
      }
      if (res.plan && api.takeRemote(planRef.current ?? undefined, res.plan, !!outbox.current.plan)) {
        planRef.current = res.plan; setPlanRaw(res.plan); void db.get().kvSet('plan', res.plan)
      }
      if (res.catalog && catalogUsable(res.catalog)) {
        setCatalog(res.catalog); void db.get().kvSet('catalog', res.catalog)
      }
      meta.current.catalogVersion = res.catalogVersion
      meta.current.lastSync = res.serverTime
      void db.get().kvSet('meta', { lastSync: res.serverTime, catalogVersion: res.catalogVersion })
      saveOutbox()
      setSync(s => ({ ...s, phase: 'idle', lastSync: res.serverTime, error: res.rejected.length ? res.rejected.join(' · ') : undefined }))
      return res.rejected.length ? 'error' : 'ok'
    } catch (e) {
      if (e instanceof api.AuthError) {
        meta.current.account = null; void db.get().kvSet('account', null)
        setSync(s => ({ ...s, account: null, phase: 'idle' }))
      } else {
        setSync(s => ({ ...s, phase: platform().online() ? 'error' : 'offline', error: (e as Error).message }))
      }
      return 'error'
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

  const markDirty = useCallback((kind: 'sessions' | 'activities' | 'deletedActivities' | 'state' | 'plan', id?: string) => {
    const o = outbox.current
    if (kind === 'state') o.state = true
    else if (kind === 'plan') o.plan = true
    else if (id && !o[kind].includes(id)) o[kind] = [...o[kind], id]
    if (kind === 'deletedActivities' && id) o.activities = o.activities.filter(x => x !== id)
    saveOutbox()
    if (meta.current.account) schedule()
  }, [schedule])

  /* ── Laden ────────────────────────────────────────────────────────────── */

  // Bestehende Nutzer behalten ihre Stufe, wenn vorne neue Stufen dazukommen (auch nach dem Abgleich
  // auf einem neuen Gerät) – neue Nutzer ohne Training beginnen an der echten ersten Stufe
  const hasHistory = sessions.size > 0
  useEffect(() => {
    if (loaded && hasHistory && L.needsStepPins(stateRef.current)) setState(L.withStepPins)
  }, [loaded, hasHistory, state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void (async () => {
      const [ss, as, st, ac, ch, ok, cat, ob, m, acct, cons, pl] = await Promise.all([
        db.get().getAll<Session>('sessions'), db.get().getAll<Activity>('activities'),
        db.get().kvGet<UserState>('state'), db.get().kvGet<ActiveSession>('active'),
        db.get().kvGet<{ date: string; workout: WorkoutId }>('choice'), db.get().persistent(),
        db.get().kvGet<Catalog>('catalog'), db.get().kvGet<api.Outbox>('outbox'),
        db.get().kvGet<{ lastSync: string | null; catalogVersion: string | null }>('meta'),
        db.get().kvGet<api.Who | null>('account'),
        db.get().kvGet<{ health: string | null; disclaimer: string | null }>('consent'),
        db.get().kvGet<Plan | null>('plan'),
      ])
      setSessions(new Map(ss.map(s => [s.id, s])))
      setActivities(as)
      setStateRaw(st ?? EMPTY_STATE)
      setActive(ac ?? null)
      setChoice(ch ?? null)
      setPersistent(ok)
      if (cons) { consentRef.current = cons; setConsentRaw(cons) }
      if (pl) { planRef.current = pl; setPlanRaw(pl) }
      if (catalogUsable(cat)) setCatalog(cat)
      outbox.current = { ...api.EMPTY_OUTBOX, ...ob }
      meta.current = { lastSync: m?.lastSync ?? null, catalogVersion: m?.catalogVersion ?? null, account: acct ?? undefined }
      setSync({ account: acct ?? undefined, phase: platform().online() ? 'idle' : 'offline', lastSync: m?.lastSync ?? null, pending: api.pendingCount(outbox.current) })
      setLoaded(true)

      // Anmeldung prüfen und Sitzung verlängern, dann abgleichen
      if (platform().online()) {
        try {
          const who = await api.me()
          if (who) await claimDevice(who)
          meta.current.account = who; void db.get().kvSet('account', who)
          // auf einem anderen Gerät schon eingewilligt → hier übernehmen
          if (who?.healthConsent === HEALTH_CONSENT_VERSION && consentRef.current.health !== HEALTH_CONSENT_VERSION)
            setConsent({ ...consentRef.current, health: HEALTH_CONSENT_VERSION })
          setSync(s => ({ ...s, account: who }))
          if (who) { await api.refresh(); void runSync() }
        } catch { /* Server nicht erreichbar – später erneut */ }
      }
    })()

    const tick = () => setToday(L.localDate())
    const id = setInterval(tick, 60_000)
    const offForeground = platform().onForeground(() => { tick(); if (meta.current.account) schedule(500) })
    const offOnline = platform().onOnlineChange(online => {
      setSync(s => ({ ...s, phase: online ? 'idle' : 'offline' }))
      if (online && meta.current.account) schedule(500)
    })
    return () => { clearInterval(id); offForeground(); offOnline() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Abgeleitet ───────────────────────────────────────────────────────── */

  const sessionList = useMemo(() => [...sessions.values()].filter(s => !s.deleted), [sessions])
  const recommended = useMemo(() => L.recommendWorkout(ix, sessionList, today), [ix, sessionList, today])
  /** Workout von heute: ausdrückliche Wahl > laufende/begonnene Einheit > Empfehlung */
  const workout: WorkoutId = useMemo(() => {
    const known = (w?: WorkoutId) => (w && ix.workouts.has(w) ? w : undefined)
    if (choice?.date === today && known(choice.workout) && !ix.workouts.get(choice.workout)!.archived) return choice.workout
    const started = sessionList.filter(s => s.date === today && s.sets.length)
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
    return known(active?.workout) ?? known(started?.workout) ?? recommended
  }, [ix, choice, today, sessionList, active, recommended])
  // heutige Einheit: die laufende Session, sonst die jüngste dieses Workouts von heute (ein zweites Mal am Tag = „-2“)
  const currentId = active && active.workout === workout ? activeSessionId(active) : L.latestSessionId(sessions, today, workout).id
  // „Nochmal trainieren“ vorgemerkt, Session noch nicht gestartet (Runden-Workout): leere Einheit zeigen
  const [againFor, setAgainFor] = useState<WorkoutId | null>(null)
  const todaySession = !active && againFor === workout ? undefined : L.live(sessions.get(currentId))
  /** heute laut Wochenplan kein Training – solange nichts gewählt, begonnen oder trainiert wurde */
  const restDay = useMemo(() => !ix.catalog.weekplan[L.weekdayOf(today)] && choice?.date !== today && !active
    && !sessionList.some(s => s.date === today && s.sets.length), [ix, today, choice, active, sessionList])

  /* ── Ändern (immer lokal + Postausgang) ───────────────────────────────── */

  const putSession = useCallback((s: Session) => {
    // Ref sofort mitführen: Aktionen direkt danach (Beenden nach dem Speichern der Runden) sehen
    // sonst noch den Stand vor dem nächsten Render und hielten die Einheit für leer
    sessionsRef.current = new Map(sessionsRef.current).set(s.id, s)
    setSessions(prev => new Map(prev).set(s.id, s))
    void db.get().put('sessions', s)
    markDirty('sessions', s.id)
  }, [markDirty])

  const updateToday = useCallback((fn: (s: Session) => Session) => {
    const id = active && active.workout === workout ? activeSessionId(active) : L.latestSessionId(sessionsRef.current, today, workout).id
    putSession(fn(L.live(sessionsRef.current.get(id)) ?? { ...L.emptySession(today, workout), id }))
  }, [today, workout, active, putSession])

  const setState = useCallback((fn: (s: UserState) => UserState) => {
    const next = { ...fn(stateRef.current), updatedAt: Date.now() }
    setStateRaw(next); void db.get().kvSet('state', next)
    markDirty('state')
  }, [markDirty])

  const chooseWorkout = useCallback((w: WorkoutId) => {
    const c = { date: today, workout: w }
    setChoice(c); void db.get().kvSet('choice', c)
  }, [today])
  /** Wahl für heute zurücknehmen (z. B. „Doch trainieren“ am Ruhetag) – zählt dann wieder der Plan */
  const clearChoice = useCallback(() => { setChoice(null); void db.get().kvSet('choice', undefined) }, [])
  /** heute eigentlich Ruhetag, aber ein Workout gewählt und noch nicht begonnen */
  const restDayChosen = useMemo(() => !ix.catalog.weekplan[L.weekdayOf(today)] && choice?.date === today && !active
    && !sessionList.some(s => s.date === today && s.sets.length), [ix, today, choice, active, sessionList])

  /** Session starten – optional für ein anderes Workout als das gewählte (Schnellstart auf Heute) */
  const startSession = useCallback((w?: WorkoutId, opts: { again?: boolean } = {}) => {
    if (active) return
    const wk = w ?? workout
    // again: dasselbe Workout heute noch einmal – neue, eigene Einheit statt die erledigte fortzusetzen
    const again = opts.again || againFor === wk
    setAgainFor(null)
    const latest = L.latestSessionId(sessionsRef.current, L.localDate(), wk)
    const id = again && sessionsRef.current.get(latest.id) ? L.sessionId(L.localDate(), wk, latest.n + 1) : latest.id
    const before = L.live(sessionsRef.current.get(id))
    const a: ActiveSession = { start: Date.now(), workout: wk, id, ...(before ? { before } : {}) }
    setActive(a); void db.get().kvSet('active', a)
  }, [active, workout, againFor])
  /** „Nochmal trainieren“ vormerken, ohne die Session zu starten (startet mit der ersten Runde) */
  const prepareAgain = useCallback((w: WorkoutId) => setAgainFor(w), [])
  const cancelAgain = useCallback(() => setAgainFor(null), [])

  /** Abbrechen: Session endet ohne Zeitgutschrift, Sätze seit dem Start werden verworfen */
  const discardSession = useCallback(() => {
    if (!active) return
    const id = activeSessionId(active)
    const s = L.discardedSession(sessionsRef.current.get(id), active.before)
    if (s) putSession(s)
    setActive(null); void db.get().kvSet('active', undefined)
  }, [active, putSession])

  /** Beenden: Dauer ab 60 s wird der Einheit gutgeschrieben (mehrere pro Tag summieren sich) */
  const endSession = useCallback(() => {
    if (!active) return
    const seconds = (Date.now() - active.start) / 1000
    if (seconds >= 60) {
      const date = L.localDate(new Date(active.start)), id = activeSessionId(active)
      putSession(L.withDuration(L.live(sessionsRef.current.get(id)) ?? { ...L.emptySession(date, active.workout), id }, seconds))
    }
    setActive(null); void db.get().kvSet('active', undefined)
  }, [active, putSession])

  /** Einheit löschen – läuft sie gerade, endet die Session ohne Zeitgutschrift */
  const removeSession = useCallback((id: string) => {
    const s = sessionsRef.current.get(id)
    if (!s || s.deleted) return
    putSession(L.deletedSession(s))
    if (active && activeSessionId(active) === id) { setActive(null); void db.get().kvSet('active', undefined) }
  }, [active, putSession])

  const addActivity = useCallback((a: Activity) => {
    const next = { ...a, updatedAt: Date.now() }
    setActivities(prev => [...prev.filter(x => x.id !== next.id), next]); void db.get().put('activities', next)
    markDirty('activities', next.id)
  }, [markDirty])
  const removeActivity = useCallback((id: string) => {
    setActivities(prev => prev.filter(x => x.id !== id)); void db.get().remove('activities', id)
    markDirty('deletedActivities', id)
  }, [markDirty])

  /** v1-Export übernehmen: gleiche Einheiten (datum-workout) werden ersetzt, andere bleiben */
  const importV1 = useCallback(async (v1: unknown) => {
    const { data, warnings, dropped } = migrate(v1, bundledCatalog, positionsJson as V1Positions)
    const now = Date.now()
    const sessionsIn = data.sessions.map(s => ({ ...s, updatedAt: now }))
    const activitiesIn = data.activities.map(a => ({ ...a, updatedAt: now }))
    const stateIn = { ...data.state, updatedAt: now }
    for (const s of sessionsIn) await db.get().put('sessions', s)
    for (const a of activitiesIn) await db.get().put('activities', a)
    await db.get().kvSet('state', stateIn)
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

  /** Trainingsdaten dieses Geräts entfernen (Abmelden, Konto löschen, anderes Konto): Einheiten,
      Aktivitäten, Trainingsstand, Plan, laufende Session, Postausgang. Katalog und Hinweis zum
      ersten Start bleiben – sie gehören zu keinem Konto. */
  const wipeLocal = useCallback(async () => {
    const d = db.get()
    for (const s of await d.getAll<Session>('sessions')) await d.remove('sessions', s.id)
    for (const a of await d.getAll<Activity>('activities')) await d.remove('activities', a.id)
    for (const k of ['state', 'active', 'choice', 'plan', 'outbox', 'owner']) await d.kvSet(k, undefined)
    outbox.current = { ...api.EMPTY_OUTBOX }
    setSessions(new Map()); setActivities([]); setStateRaw(EMPTY_STATE); setActive(null); setChoice(null)
    planRef.current = null; setPlanRaw(null)
    setSync(s => ({ ...s, pending: 0 }))
  }, [])
  /** Konto, dem die Daten auf dem Gerät gehören: bei der Anmeldung eines anderen Kontos erst leeren –
      sonst würden fremde Trainingsdaten zum neuen Konto hochgeladen */
  const claimDevice = useCallback(async (who: api.Who) => {
    const owner = await db.get().kvGet<string>('owner')
    if (owner && who.id != null && owner !== String(who.id)) await wipeLocal()
    if (who.id != null) await db.get().kvSet('owner', String(who.id))
  }, [wipeLocal])

  /** nach jeder Anmeldung: Gerät übernehmen, Einwilligung (Häkchen im Formular) am Konto speichern, abgleichen */
  const afterLogin = useCallback(async (who: api.Who, healthConsent: boolean) => {
    await claimDevice(who)
    meta.current.account = who; void db.get().kvSet('account', who)
    if (healthConsent && who.id != null) {
      await api.saveConsent(who.id, HEALTH_CONSENT_VERSION)
      setConsent({ ...consentRef.current, health: HEALTH_CONSENT_VERSION })
    } else if (who.healthConsent === HEALTH_CONSENT_VERSION) setConsent({ ...consentRef.current, health: HEALTH_CONSENT_VERSION })
    setSync(s => ({ ...s, account: who, consentMissing: false }))
    await runSync()
  }, [runSync, claimDevice])
  /** Anmelden mit E-Mail und Passwort */
  const signIn = useCallback(async (email: string, password: string, healthConsent = false) => {
    await afterLogin(await api.login(email, password), healthConsent)
  }, [afterLogin])
  /** neues Passwort aus dem Mail-Link – danach angemeldet */
  const resetPassword = useCallback(async (token: string, password: string) => {
    await afterLogin(await api.resetPassword(token, password), false)
  }, [afterLogin])
  /** Apple-ID an das angemeldete Konto hängen / wieder lösen (Profil) */
  const setAppleLink = useCallback(async (identityToken: string | null) => {
    if (identityToken) await api.linkApple(identityToken); else await api.unlinkApple()
    const acc = meta.current.account
    if (!acc) return
    const next = { ...acc, apple: !!identityToken }
    meta.current.account = next; void db.get().kvSet('account', next)
    setSync(s => ({ ...s, account: next }))
  }, [])
  /** Sign in with Apple (identityToken aus dem nativen Dialog) */
  const signInWithApple = useCallback(async (identityToken: string, healthConsent = false) => {
    await afterLogin(await api.appleLogin(identityToken), healthConsent)
  }, [afterLogin])

  /** Einwilligung nachträglich geben (angemeldet, z. B. nach einem Update mit neuer Textfassung) */
  const acceptHealthConsent = useCallback(async () => {
    const who = meta.current.account?.id != null ? meta.current.account : await api.me()
    if (!who?.id) throw new Error('Nicht angemeldet')
    await api.saveConsent(who.id, HEALTH_CONSENT_VERSION)
    setConsent({ ...consentRef.current, health: HEALTH_CONSENT_VERSION })
    setSync(s => ({ ...s, consentMissing: false }))
    await runSync()
  }, [runSync])
  const acceptDisclaimer = useCallback(() => setConsent({ ...consentRef.current, disclaimer: DISCLAIMER_VERSION }), [])

  /** Abmelden: erst alles abgleichen, dann die Daten vom Gerät entfernen (sie liegen auf dem Server).
      Ist noch etwas nicht abgeglichen und der Abgleich klappt nicht, bricht es ab – außer mit force. */
  const signOut = useCallback(async (opts: { force?: boolean } = {}) => {
    if (api.pendingCount(outbox.current) > 0 && !opts.force) {
      const r = await runSync()
      if (r !== 'ok' && api.pendingCount(outbox.current) > 0) throw new UnsyncedError(api.pendingCount(outbox.current))
    }
    await api.logout()
    meta.current = { ...meta.current, account: null, lastSync: null }
    void db.get().kvSet('account', null)
    void db.get().kvSet('meta', { lastSync: null, catalogVersion: meta.current.catalogVersion })
    setConsent({ ...consentRef.current, health: null })   // gilt pro Konto
    await wipeLocal()
    setSync(s => ({ ...s, account: null, consentMissing: false, lastSync: null }))
  }, [runSync, wipeLocal])

  /** Plan speichern (eigene Workouts, Wochenplan) – neue Version, wird abgeglichen */
  const savePlan = useCallback((next: Plan) => {
    const p = { ...next, version: (planRef.current?.version ?? 0) + 1, updatedAt: Date.now() }
    planRef.current = p; setPlanRaw(p); void db.get().kvSet('plan', p)
    markDirty('plan')
  }, [markDirty])
  /** Plan ändern; ohne eigenen Plan entsteht er hier aus dem Katalog-Plan (erst die erste Änderung legt ihn an) */
  const editPlan = useCallback((fn: (p: Plan) => Plan) => {
    savePlan(fn(planRef.current ?? L.planFromCatalog(catalog)))
  }, [savePlan, catalog])

  /** Konto löschen (Server: Konto + alle Trainingsdaten), danach auch auf dem Gerät */
  const deleteAccount = useCallback(async () => {
    await api.deleteAccount()
    meta.current = { ...meta.current, account: null, lastSync: null }
    void db.get().kvSet('account', null)
    void db.get().kvSet('meta', { lastSync: null, catalogVersion: meta.current.catalogVersion })
    setConsent({ ...consentRef.current, health: null })
    await wipeLocal()
    setSync(s => ({ ...s, account: null, error: undefined, consentMissing: false, lastSync: null }))
  }, [wipeLocal])

  return {
    loaded, persistent, today, ix, sessions: sessionList, activities, state, active, workout, recommended, restDay,
    todaySession, updateToday, setState, chooseWorkout, clearChoice, restDayChosen, startSession, prepareAgain, cancelAgain, endSession,
    addActivity, removeActivity, removeSession, discardSession, importV1, exportData,
    /** aktueller Stand einer Einheit – auch direkt nach einer Änderung, vor dem nächsten Render */
    getSession: (id: string) => sessionsRef.current.get(id),
    sync, syncNow: runSync, signIn, signInWithApple, register: api.register, forgotPassword: api.forgotPassword, verifyEmail: api.verifyEmail, resetPassword, setAppleLink, signOut, deleteAccount,
    consent, acceptHealthConsent, acceptDisclaimer,
    plan, savePlan, editPlan, baseCatalog: catalog,
  }
}
export type Training = ReturnType<typeof useTraining>
