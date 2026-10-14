'use client'
// zuerst: Plattform-Adapter (Speicher, Netz, Token) für den gemeinsamen Kern registrieren
import '../platformWeb'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as L from '@/core/logic'
import { keepAwake } from '../signals'
import { askNotifications, isNative, nativeActions, nativePanel, nativeRest, nativeTabs, type NBlock } from '../native'
import { NativeShell, useNativeSheet } from '../useNativeSheet'
import { useTraining, type Training } from '@/core/useTraining'
import { useRestTimer } from '@/core/useRestTimer'
import { BottomBar } from './BottomBar'
import { ProfileSheet } from './ProfileSheet'
import { PlanView } from './PlanView'
import { Onboarding, needsOnboarding } from './Onboarding'
import { usePlanSuggestion } from '@/core/usePlanSuggestion'
import { catalogData } from '@/core/data'
import { Icon, type IconName } from './Icon'
import { DaySheet, HistoryView, type DayItem } from './HistoryView'
import { hasClip } from './ExerciseMedia'
import { ActivitySheet, ExerciseSheet, SetSheet, exerciseSheetSpec } from './Sheets'
import { FocusView } from './FocusView'
import { HomeView } from './HomeView'
import { SkillsView } from './SkillsView'
import { Splash } from './Splash'
import { SummaryOverlay } from './SummaryOverlay'
import { ConsentGate } from './ConsentGate'
import { RestOverlay } from './RestOverlay'
import { PlanSheet } from './WorkoutView'
import { WorkoutsHost } from './PlanEditor'
import { SkillSheet } from './SkillsView'
import { useDrag, usePresence } from '../useSheet'
import { currentChoice, initialLocale, saveLocale, setLocale, t as tr, type Locale, type LocaleChoice } from '@/core/i18n'
import { Toaster } from './Toaster'

type SheetState = { kind: 'set'; pid: string; setNo: number } | { kind: 'activity'; date: string } | { kind: 'options'; pid: string } | null
type View = 'train' | 'plan' | 'skills' | 'history'
const VIEWS: [View, IconName][] = [['train', 'training'], ['plan', 'plan'], ['skills', 'skills'], ['history', 'history']]
const tabTitle = (v: View) => tr(`app.tab.${v}`)
/** SF Symbols für die native Tab-Leiste der iOS-App */
const SYMBOLS: Record<View, string> = { train: 'figure.strengthtraining.traditional', plan: 'list.bullet.rectangle', skills: 'point.3.connected.trianglepath.dotted', history: 'clock.arrow.circlepath' }

/** kleiner Punkt am „Daten“-Button: grün = abgeglichen, orange = läuft/wartet, rot = Fehler, grau = nicht angemeldet/offline */
const syncDot = (s: Training['sync']) => !s.account ? '' : s.phase === 'error' ? 'err' : s.phase === 'syncing' || s.pending ? 'busy' : s.phase === 'offline' ? '' : 'on'
const syncLabel = (s: Training['sync']) => !s.account ? tr('app.sync.signedOut') : s.phase === 'error' ? tr('app.sync.error') : s.pending ? tr('app.sync.pending') : tr('app.sync.synced')


export function TrainingApp() {
  // Sprache vor dem ersten Rendern der Texte setzen; Wechsel → State → ganze App rendert neu
  const [locale, setLocaleState] = useState<Locale>(() => { const l = initialLocale(); setLocale(l); return l })
  const [localeChoice, setLocaleChoice] = useState<LocaleChoice>(currentChoice)
  const changeLocale = (l: LocaleChoice) => {
    saveLocale(l)
    const next = initialLocale()
    setLocale(next); setLocaleChoice(l); setLocaleState(next)
  }
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  const t = useTraining()
  const ps = usePlanSuggestion(t)
  const rest = useRestTimer()
  const [view, setView] = useState<View>('train')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [picked, setPicked] = useState<string | undefined>()
  // Training als Vollbild-Sheet über allen Tabs; minimiert bleibt die Session-Leiste (wie ein Mini-Player)
  const [trainOpen, setTrainOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)          // Übungsplan als Sheet (vor und während des Trainings)
  const [skillPid, setSkillPid] = useState<string | null>(null)
  const [day, setDay] = useState<DayItem | null>(null)          // Einheit/Cardio aus dem Verlauf
  const [workouts, setWorkouts] = useState<{ edit?: string } | null>(null)   // neu gespeichertes Workout weiterbearbeiten
  const [profileOpen, setProfileOpen] = useState(false)          // Profil (Konto, Sync, Daten) über den Avatar
  // Onboarding einmal öffnen, sobald die Bedingung erfüllt ist – bleibt offen, auch wenn unterwegs ein Profil entsteht
  const [onboarding, setOnboarding] = useState(false)
  const wantsOnboarding = needsOnboarding(t)
  useEffect(() => { if (wantsOnboarding) setOnboarding(true) }, [wantsOnboarding])
  // Gescrollt wird nur der Inhaltsbereich, nie die Seite: iOS verschiebt fixierte Leisten sonst,
  // sobald sich die Seitenhöhe ändert (Tab-Wechsel von lang nach kurz)
  const scroller = useRef<HTMLElement>(null)
  const toTop = () => scroller.current?.scrollTo(0, 0)
  const [restView, setRestView] = useState<string | null>(null)
  const [summaryId, setSummaryId] = useState<string | null>(null)   // Rückmeldung zum gespeicherten Satz, solange der Pausen-Screen offen ist

  // Nach einem Neustart mitten im Training direkt zurück in den Fokus
  useEffect(() => { if (t.loaded && t.active) setTrainOpen(true) }, [t.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Service Worker nur im Produktionsbuild – im Dev-Modus würde er Änderungen verdecken
  useEffect(() => {
    // in der iOS-App liegt alles im App-Paket – dort kein Service Worker
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && !isNative()) void navigator.serviceWorker.register('/sw.js')
  }, [])

  // Display wach halten, solange eine Session läuft; nach App-Wechsel neu anfordern
  useEffect(() => {
    void keepAwake(!!t.active)
    const again = () => { if (!document.hidden && t.active) void keepAwake(true) }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [t.active])

  const slots = useMemo(
    () => (t.loaded ? L.workoutSlots(t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today, { meta: catalogData(t.ix.catalog).meta }) : []),
    [t.loaded, t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today, locale],   // locale: Beschriftungen in den Slots
  )
  // Fokus: ausgewählte Übung, sonst die erste offene
  const focus = picked && slots.some(s => s.pid === picked) ? picked : L.firstOpen(slots.map(s => ({ pid: s.pid, state: s.state })))
  const sheetSlot = sheet?.kind === 'set' || sheet?.kind === 'options' ? slots.find(s => s.pid === sheet.pid) : undefined
  const focusSlot = slots.find(s => s.pid === focus)

  const started = !!t.active || (t.todaySession?.sets.length ?? 0) > 0
  const showHome = view === 'train'
  // native Sheets liegen selbst über der Tab-Leiste – ausblenden nur für Web-Ebenen
  // Pause gilt nur als offen, solange sie läuft oder klingelt (restView bleibt sonst stehen)
  const restShown = restView !== null && (rest.running || rest.ringing)
  const hideNativeTabs = trainOpen || !!summaryId || restShown
  const showBar = !trainOpen && (!!t.active || rest.running || rest.ringing)
  const summarySession = summaryId ? t.sessions.find(s => s.id === summaryId) : undefined
  const start = () => { t.startSession(); void askNotifications(); setPlanOpen(false); openFocus(undefined) }
  const doneToday = started && !L.upNext(slots, undefined)
  const finish = () => {
    if (!t.active) return
    const id = L.sessionId(L.localDate(new Date(t.active.start)), t.active.workout)
    t.endSession(); rest.stop(); setRestView(null); setTrainOpen(false); setPlanOpen(false); setSummaryId(id)
  }
  const openFocus = (pid?: string) => { setPicked(pid); setTrainOpen(true); setPlanOpen(false) }
  const train = usePresence(trainOpen)
  const trainDrag = useDrag({ onDown: () => setTrainOpen(false), threshold: 120 })

  // iOS-App: native Liquid-Glass-Tab-Leiste statt der eigenen
  const [nativeShell, setNativeShell] = useState(false)
  // Native Tab-Leiste erst nach der Startanimation – sie läge sonst über dem Splash
  const [splashDone, setSplashDone] = useState(false)
  const goTo = useRef<(k: View) => void>(() => undefined)
  goTo.current = (k: View) => { setView(k); toTop() }
  const onAction = useRef<(id: string) => void>(() => undefined)
  onAction.current = (id: string) => {
    if (id === 'back') setTrainOpen(false)
    else if (id === 'list') setPlanOpen(true)
    else if (id === 'profile') setProfileOpen(true)
  }
  useEffect(() => {
    if (!t.loaded || !splashDone || !isNative()) return
    void nativeTabs.configure(VIEWS.map(([id]) => ({ id, title: tabTitle(id), symbol: SYMBOLS[id] })), view, id => goTo.current(id as View), id => onAction.current(id))
      .then(ok => setNativeShell(ok))
  }, [t.loaded, splashDone]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (nativeShell) nativeTabs.select(view) }, [nativeShell, view])
  useEffect(() => { if (nativeShell) nativeTabs.hide(hideNativeTabs) }, [nativeShell, hideNativeTabs])
  // Native Glas-Buttons im Training: oben links minimieren, oben rechts Übungsliste
  const trainButtons = nativeShell && trainOpen && !summaryId && !restShown
  useEffect(() => {
    if (!nativeShell) return
    if (trainButtons) {
      nativeActions.set('back', { symbol: 'chevron.down', position: 'topLeading' })
      nativeActions.set('list', { symbol: 'list.bullet', position: 'topTrailing' })
    } else { nativeActions.remove('back'); nativeActions.remove('list') }
  }, [nativeShell, trainButtons])
  // Profil rechts oben auf den Hauptseiten (im Training belegt die Übungsliste den Platz)
  const profileButton = nativeShell && !trainOpen && !summaryId && !restShown
  const syncError = !!t.sync.account && t.sync.phase === 'error'
  useEffect(() => {
    if (!nativeShell) return
    if (profileButton) nativeActions.set('profile', { symbol: syncError ? 'exclamationmark.icloud' : 'person.crop.circle', position: 'topTrailing' })
    else nativeActions.remove('profile')
  }, [nativeShell, profileButton, syncError])
  // Technik & Optionen als natives Sheet
  const optSlot = nativeShell && sheet?.kind === 'options' ? slots.find(s => s.pid === sheet.pid) : undefined
  const opt = optSlot ? exerciseSheetSpec(t, optSlot) : null
  useNativeSheet(opt ? {
    id: 'technik', title: opt.spec.title, subtitle: opt.spec.subtitle, detents: ['medium', 'large'],
    blocks: [
      ...opt.spec.sections.map((x): NBlock => ({ type: 'text', title: x.title, text: x.text, style: x.warn ? 'warn' : 'body' })),
      ...opt.spec.actions.map((a): NBlock => ({ type: 'button', id: a.id, title: a.title, symbol: a.symbol, style: a.style })),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id) opt?.run(e.id)
    if (e.type === 'tap' || e.type === 'dismiss') setSheet(null)
  })
  // Erfassungs-Panel: nur im offenen Training ohne Pause/Abschluss darüber
  // bleibt auch während der Pause stehen – der Pausen-Screen liegt darüber (nie umgekehrt)
  const panelOn = nativeShell && trainOpen && train.shown && !summaryId
  useEffect(() => { if (nativeShell && !panelOn) nativePanel.set(null) }, [nativeShell, panelOn])
  const [panelH, setPanelH] = useState(0)
  // Pausen-Screen nativ: zeigen, solange eine Pause läuft/klingelt und die Ansicht offen ist
  const restOpen = trainOpen && restShown
  const restNext = restOpen ? L.upNext(slots, focus) : null
  const restSpec = nativeShell && restOpen ? JSON.stringify({
    end: rest.end, total: rest.total, ringing: rest.ringing, saved: restView || undefined,
    nextTitle: restNext ? tr('app.restNext', { set: restNext.setNo, total: restNext.slot.planned }) : undefined,
    nextSubtitle: restNext ? tr('app.restNextSub', { name: restNext.slot.step.exercise.name, target: restNext.slot.step.target.label }) : undefined,
    nextClip: restNext && hasClip(restNext.slot.step.exercise.id) ? restNext.slot.step.exercise.id : undefined,
  }) : ''
  useEffect(() => { if (nativeShell) nativeRest.set(restSpec ? JSON.parse(restSpec) : null) }, [nativeShell, restSpec])
  useEffect(() => nativeRest.on(type => {
    if (type === 'minus') rest.shift(-15)
    else if (type === 'plus') rest.shift(30)
    else if (type === 'go') { rest.stop(); setRestView(null) }
    else setRestView(null)
  }), [rest.shift, rest.stop]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => nativePanel.onHeight(setPanelH), [])
  // Punkt am Plan-Tab, solange ein Vorschlag auf Bestätigung wartet
  const pending = !!ps.suggestion
  useEffect(() => { if (nativeShell) nativeTabs.badge('plan', pending ? '' : null, 'volt') }, [nativeShell, pending])
  // Sprachwechsel: nur die Tab-Titel tauschen
  useEffect(() => { if (nativeShell) nativeTabs.retitle(VIEWS.map(([id]) => ({ id, title: tabTitle(id) }))) }, [nativeShell, locale])

  // Splash steht in beiden Zweigen an derselben Stelle – so läuft die Animation beim Laden einfach weiter
  const splash = <Splash ready={t.loaded} onDone={() => setSplashDone(true)} />
  if (!t.loaded) return <>{splash}<div className="shell"><main className="app loading" aria-busy="true" /></div></>

  return (
    <>{splash}
    <NativeShell.Provider value={nativeShell}>
    <div className={`shell${nativeShell ? ' native' : ''}`}>
    <main ref={scroller} className={`app${showBar ? ' with-bar' : ''}`} aria-hidden={trainOpen || undefined}>
      <h1 className="sr-only">Lever</h1>
      {!nativeShell && (
        <button className="profile-btn" aria-label={tr('app.profileButton', { status: syncLabel(t.sync) })} onClick={() => setProfileOpen(true)}>
          <Icon name="user" size={22} />
          <span className={`sync-dot ${syncDot(t.sync)}`} aria-hidden="true" />
        </button>
      )}
      {view === 'plan' && <PlanView t={t} ps={ps} />}
      {view === 'skills' && <SkillsView t={t} onOpen={setSkillPid} />}
      {view === 'history' && <HistoryView t={t} openActivity={date => setSheet({ kind: 'activity', date })} openDay={setDay} />}
      {showHome && (
        <HomeView t={t} slots={slots} started={started} done={doneToday} onStart={t.active ? () => openFocus(undefined) : start}
          onSummary={t.todaySession ? () => setSummaryId(t.todaySession!.id) : undefined}
          onBrowse={() => setPlanOpen(true)} onSkills={() => { setView('skills'); toTop() }} onManage={() => { setView('plan'); toTop() }} />
      )}
    </main>

      {train.mounted && (
        <div className={`tsheet${train.shown ? ' open' : ''}${nativeShell ? ' native-panel' : ''}`} role="dialog" aria-modal="true" aria-label={tr('app.training')}
          style={{ ...trainDrag.style, ...(panelH ? { ['--panel-h' as string]: `${panelH}px` } : {}) }}>
          <FocusView t={t} rest={rest} slots={slots} slot={focusSlot} drag={trainDrag.bind}
            onMinimize={() => setTrainOpen(false)}
            onList={() => setPlanOpen(true)}
            onPick={pid => setPicked(pid)}
            openSet={(pid, setNo) => setSheet({ kind: 'set', pid, setNo })}
            openOptions={pid => setSheet({ kind: 'options', pid })}
            onFinish={finish} panel={panelOn} onRest={() => setRestView('')}
            onSaved={(s, setNo, summary) => {
              // letzter geplanter Satz → nach der Pause geht es mit der nächsten offenen Übung weiter
              if (L.nextSetNo({ sets: [...s.sets, { exercise: s.step.exercise.id, progression: s.pid, set: setNo, value: 0 }], planned: s.planned }) === null) setPicked(undefined)
              if (s.step.target.restSec > 0) setRestView(summary)
            }} />
          {!nativeShell && restView !== null && (rest.running || rest.ringing) && (
            <RestOverlay rest={rest} saved={restView} next={L.upNext(slots, focus)} onClose={() => setRestView(null)} />
          )}
        </div>
      )}

      <div className={`dock${trainOpen ? ' under' : ''}`}>
        {showBar && <BottomBar t={t} rest={rest} onStart={start} onStop={finish} onOpen={() => setTrainOpen(true)} />}
        {!nativeShell && <nav className="tabs" aria-label={tr('app.tabsLabel')}>
          {VIEWS.map(([k, icon]) => (
            <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined}
              onClick={() => { setView(k); toTop() }}>
              <span className="tab-icon">
                <Icon name={icon} size={22} />
                {k === 'plan' && pending && <span className="sync-dot busy" role="img" aria-label={tr('app.planPending')} />}
              </span>
              {tabTitle(k)}
            </button>
          ))}
        </nav>}
      </div>

      {planOpen && (
        <PlanSheet t={t} slots={slots} focus={focus} onClose={() => setPlanOpen(false)} onStart={t.active ? undefined : start}
          openFocus={openFocus} openActivity={() => setSheet({ kind: 'activity', date: t.today })}
          onSavedWorkout={id => { setPlanOpen(false); setWorkouts({ edit: id }) }} />
      )}
      {workouts && <WorkoutsHost t={t} list={false} initial={workouts.edit} onClose={() => setWorkouts(null)} />}
      {profileOpen && <ProfileSheet t={t} onClose={() => setProfileOpen(false)} localeChoice={localeChoice} changeLocale={changeLocale} />}
      {onboarding && <Onboarding t={t} ps={ps} onClose={() => setOnboarding(false)} />}
      {skillPid && <SkillSheet t={t} pid={skillPid} onClose={() => setSkillPid(null)} />}
      {day && <DaySheet t={t} item={day} onClose={() => setDay(null)} openActivity={date => setSheet({ kind: 'activity', date })} />}

      {sheetSlot && sheet?.kind === 'set' && (
        <SetSheet key={`${sheet.pid}-${sheet.setNo}`} t={t} slot={sheetSlot} setNo={sheet.setNo} rest={rest}
          onClose={() => setSheet(null)}
          onSaved={() => {
            // letzte offene Satz-Nummer erfasst → Fokus wandert zur nächsten offenen Übung
            if (sheetSlot.sets.length + 1 >= sheetSlot.planned && !sheetSlot.sets.some(x => x.set === sheet.setNo)) setPicked(undefined)
            setSheet(null)
          }} />
      )}
      {sheetSlot && sheet?.kind === 'options' && !nativeShell && <ExerciseSheet t={t} slot={sheetSlot} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'activity' && <ActivitySheet t={t} date={sheet.date} onClose={() => setSheet(null)} />}
      <ConsentGate t={t} />
      {!nativeShell && <Toaster />}
      {summarySession && <SummaryOverlay t={t} session={summarySession} onClose={() => { setSummaryId(null); toTop() }} />}
    </div>
    </NativeShell.Provider>
    </>
  )
}
