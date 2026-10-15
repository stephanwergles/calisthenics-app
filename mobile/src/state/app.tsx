/* App-Zustand: der gemeinsame Kern (useTraining, Planvorschlag, Pausen-Timer) einmal für die
   ganze App, dazu was im Web TrainingApp orchestriert: Sprache, Übungen des Tages (slots),
   Fokus, Start/Ende der Session, Pausen-Ansicht. Screens lesen über useApp(). */
import { createContext, use, useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useTraining, activeSessionId, type Training } from '@lever/core/useTraining.ts'
import { usePlanSuggestion, type PlanSuggestion } from '@lever/core/usePlanSuggestion.ts'
import { useRestTimer, type RestTimer } from '@lever/core/useRestTimer.ts'
import { catalogData } from '@lever/core/data.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { ask, choose } from '@/ui'
import { useSessionActivity } from '@/live/use-session-activity'
import { currentChoice, initialLocale, saveLocale, setLocale, type Locale, type LocaleChoice } from '@lever/core/i18n/index.ts'

export interface App {
  t: Training
  ps: PlanSuggestion
  rest: RestTimer
  locale: Locale
  localeChoice: LocaleChoice
  changeLocale: (l: LocaleChoice) => void
  /** Übungen des heutigen Workouts mit Stand */
  slots: L.SlotView[]
  /** Übung im Fokus (gewählt oder erste offene) */
  focus: string | undefined
  focusSlot: L.SlotView | undefined
  pick: (pid: string | undefined) => void
  /** Session begonnen oder heute schon Sätze */
  started: boolean
  /** alles erledigt */
  doneToday: boolean
  /** Session starten und Training öffnen */
  start: () => void
  /** beliebiges Workout wählen, starten und öffnen (Schnellstart) */
  /** again: dasselbe Workout heute noch einmal als neue Einheit */
  startWorkout: (id: string, again?: boolean) => void
  /** Training öffnen (optional auf eine Übung) */
  openTraining: (pid?: string) => void
  /** Session beenden → Zusammenfassung */
  finish: () => void
  /** Beenden mit Wahl: speichern oder verwerfen (Rückfrage); weiter trainieren = nichts */
  askEnd: () => Promise<void>
  /** Training verwerfen (mit Rückfrage, wenn schon etwas eingetragen ist) */
  askDiscard: () => Promise<void>
  /** Training ohne Rückfrage verwerfen */
  discard: () => void
  /** Pausen-Screen: null = zu, sonst Rückmeldung zum gespeicherten Satz ('' = ohne) */
  restView: string | null
  setRestView: (v: string | null) => void
}

const Ctx = createContext<App | null>(null)

export function useApp(): App {
  const a = use(Ctx)
  if (!a) throw new Error('useApp außerhalb von AppProvider')
  return a
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Sprache vor dem ersten Rendern der Texte setzen; Wechsel → ganze App rendert neu
  const [locale, setLocaleState] = useState<Locale>(() => { const l = initialLocale(); setLocale(l); return l })
  const [localeChoice, setLocaleChoice] = useState<LocaleChoice>(currentChoice)
  const changeLocale = (l: LocaleChoice) => {
    saveLocale(l)
    const next = initialLocale()
    setLocale(next); setLocaleChoice(l); setLocaleState(next)
  }
  const t = useTraining()
  const ps = usePlanSuggestion(t)
  const rest = useRestTimer()
  const [picked, setPicked] = useState<string | undefined>()
  const [restView, setRestView] = useState<string | null>(null)

  // Display wach halten, solange eine Session läuft
  useEffect(() => { void platform().signals.keepAwake(!!t.active) }, [t.active])

  const slots = useMemo(
    () => (t.loaded ? L.workoutSlots(t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today, { meta: catalogData(t.ix.catalog).meta }) : []),
    [t.loaded, t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today, locale],
  )
  const focus = picked && slots.some(s => s.pid === picked) ? picked : L.firstOpen(slots.map(s => ({ pid: s.pid, state: s.state })))
  const focusSlot = slots.find(s => s.pid === focus)
  const started = !!t.active || (t.todaySession?.sets.length ?? 0) > 0 || (t.todaySession?.circuits?.length ?? 0) > 0
  // erledigt: alle Leiter-Übungen und alle Runden-Blöcke (reine Runden-Workouts: nicht schon beim Start)
  const doneToday = started && !L.upNext(slots, undefined) && L.circuitsOf(t.ix.workouts.get(t.workout)).every(c => L.circuitResultOf(t.todaySession, c.id))

  // Sperrbildschirm & Dynamic Island: laufende Session mit Pausen-Countdown
  useSessionActivity(t, rest, slots, focus)

  const openTraining = (pid?: string) => { setPicked(pid); router.navigate('/training') }
  // reines Runden-Workout (z. B. Cindy): die Session (Uhr, Mini-Player) beginnt erst mit der ersten
  // Runde (CircuitCard) – vorher ist nur die Übersicht offen, sonst liefe das Training schon, bevor es losgeht
  const circuitsOnly = (id: string) => {
    const w = t.ix.workouts.get(id)
    return L.circuitsOf(w).length > 0 && !(w?.slots ?? []).some(sl => t.ix.progressions.has(sl.progression))
  }
  const start = () => { if (!circuitsOnly(t.workout)) t.startSession(); openTraining(undefined) }
  const startWorkout = (id: string, again = false) => {
    if (t.active) { openTraining(undefined); return }
    t.chooseWorkout(id)
    // „Nochmal trainieren“ braucht die neue Einheit sofort, sonst stünde dort die erledigte
    if (again || !circuitsOnly(id)) t.startSession(id, { again })
    openTraining(undefined)
  }
  /** seit dem Start eingetragen: Sätze und Runden-Ergebnisse */
  const loggedSinceStart = () => {
    if (!t.active) return 0
    const id = activeSessionId(t.active)
    const s = L.live(t.sessions.find(x => x.id === id))
    return (s?.sets.length ?? 0) - (t.active.before?.sets.length ?? 0) + (s?.circuits?.length ?? 0) - (t.active.before?.circuits?.length ?? 0)
  }
  const finish = () => {
    if (!t.active) return
    // nichts eingetragen: keine leere Erfolgsseite, Session einfach verwerfen
    if (loggedSinceStart() <= 0) { discard(); return }
    const id = activeSessionId(t.active)
    t.endSession(); rest.stop(); setRestView(null)
    router.dismissTo('/')
    router.push({ pathname: '/summary/[id]', params: { id } })
  }

  const discard = () => {
    t.discardSession(); rest.stop(); setRestView(null)
    router.dismissTo('/')
  }
  const askEnd = async () => {
    if (!t.active) return
    // noch nichts eingetragen: nur beenden oder weitermachen – es gibt nichts zu speichern
    if (loggedSinceStart() <= 0) {
      if (await ask({ title: tr('training.bar.stopTitle'), message: tr('training.bar.stopEmpty'), ok: tr('training.bar.stopEmptyOk'), cancel: tr('training.bar.stopContinue'), destructive: true })) discard()
      return
    }
    const choice = await choose({
      title: tr('training.bar.stopTitle'), message: tr('training.bar.stopMessage'), cancel: tr('training.bar.stopContinue'),
      options: [{ id: 'save', title: tr('training.bar.stopSave') }, { id: 'discard', title: tr('training.bar.stopDiscard'), destructive: true }],
    })
    if (choice === 'save') finish()
    if (choice === 'discard') await askDiscard()
  }
  /** Training verwerfen – mit Rückfrage, sobald seit dem Start etwas eingetragen ist */
  const askDiscard = async () => {
    if (!t.active) return
    const n = loggedSinceStart()
    if (n > 0 && !await ask({ title: tr('training.bar.discardTitle'), message: tn('training.bar.discardMessage', n), ok: tr('training.bar.discardOk'), destructive: true })) return
    discard()
  }

  const value: App = {
    t, ps, rest, locale, localeChoice, changeLocale, slots, focus, focusSlot, pick: setPicked,
    started, doneToday, start, startWorkout, openTraining, finish, askEnd, askDiscard, discard, restView, setRestView,
  }
  return <Ctx value={value}>{children}</Ctx>
}
