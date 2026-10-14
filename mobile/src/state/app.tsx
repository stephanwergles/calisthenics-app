/* App-Zustand: der gemeinsame Kern (useTraining, Planvorschlag, Pausen-Timer) einmal für die
   ganze App, dazu was im Web TrainingApp orchestriert: Sprache, Übungen des Tages (slots),
   Fokus, Start/Ende der Session, Pausen-Ansicht. Screens lesen über useApp(). */
import { createContext, use, useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useTraining, type Training } from '@lever/core/useTraining.ts'
import { usePlanSuggestion, type PlanSuggestion } from '@lever/core/usePlanSuggestion.ts'
import { useRestTimer, type RestTimer } from '@lever/core/useRestTimer.ts'
import { catalogData } from '@lever/core/data.ts'
import { platform } from '@lever/core/platform.ts'
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
  /** Training öffnen (optional auf eine Übung) */
  openTraining: (pid?: string) => void
  /** Session beenden → Zusammenfassung */
  finish: () => void
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
  const started = !!t.active || (t.todaySession?.sets.length ?? 0) > 0
  const doneToday = started && !L.upNext(slots, undefined)

  const openTraining = (pid?: string) => { setPicked(pid); router.navigate('/training') }
  const start = () => { t.startSession(); openTraining(undefined) }
  const finish = () => {
    if (!t.active) return
    const id = L.sessionId(L.localDate(new Date(t.active.start)), t.active.workout)
    t.endSession(); rest.stop(); setRestView(null)
    router.dismissTo('/')
    router.push({ pathname: '/summary/[id]', params: { id } })
  }

  const value: App = {
    t, ps, rest, locale, localeChoice, changeLocale, slots, focus, focusSlot, pick: setPicked,
    started, doneToday, start, openTraining, finish, restView, setRestView,
  }
  return <Ctx value={value}>{children}</Ctx>
}
