'use client'
import { useEffect, useMemo, useState } from 'react'
import * as L from '../logic'
import { keepAwake } from '../signals'
import { useTraining, type Training } from '../useTraining'
import { useRestTimer } from '../useRestTimer'
import { BottomBar } from './BottomBar'
import { DataView } from './DataView'
import { Icon, type IconName } from './Icon'
import { HistoryView } from './HistoryView'
import { ActivitySheet, ExerciseSheet, SetSheet } from './Sheets'
import { FocusView } from './FocusView'
import { RestOverlay } from './RestOverlay'
import { WorkoutView } from './WorkoutView'

type SheetState = { kind: 'set'; pid: string; setNo: number } | { kind: 'activity'; date: string } | { kind: 'options'; pid: string } | null
type View = 'train' | 'history' | 'data'
const VIEWS: [View, string, IconName][] = [['train', 'Training', 'training'], ['history', 'Verlauf', 'history'], ['data', 'Daten', 'data']]

/** kleiner Punkt am „Daten“-Button: grün = abgeglichen, orange = läuft/wartet, rot = Fehler, grau = nicht angemeldet/offline */
const syncDot = (s: Training['sync']) => !s.account ? '' : s.phase === 'error' ? 'err' : s.phase === 'syncing' || s.pending ? 'busy' : s.phase === 'offline' ? '' : 'on'
const syncLabel = (s: Training['sync']) => !s.account ? 'Nicht angemeldet' : s.phase === 'error' ? 'Sync-Fehler' : s.pending ? 'Änderungen warten auf Abgleich' : 'Abgeglichen'

export function TrainingApp() {
  const t = useTraining()
  const rest = useRestTimer()
  const [view, setView] = useState<View>('train')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [picked, setPicked] = useState<string | undefined>()
  const [focusMode, setFocusMode] = useState(false)
  const [restView, setRestView] = useState<string | null>(null)   // Rückmeldung zum gespeicherten Satz, solange der Pausen-Screen offen ist

  // Nach einem Neustart mitten im Training direkt zurück in den Fokus
  useEffect(() => { if (t.loaded && t.active) setFocusMode(true) }, [t.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Service Worker nur im Produktionsbuild – im Dev-Modus würde er Änderungen verdecken
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js')
  }, [])

  // Display wach halten, solange eine Session läuft; nach App-Wechsel neu anfordern
  useEffect(() => {
    void keepAwake(!!t.active)
    const again = () => { if (!document.hidden && t.active) void keepAwake(true) }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [t.active])

  const slots = useMemo(
    () => (t.loaded ? L.workoutSlots(t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today) : []),
    [t.loaded, t.ix, t.workout, t.state, t.todaySession, t.sessions, t.today],
  )
  // Fokus: ausgewählte Übung, sonst die erste offene
  const focus = picked && slots.some(s => s.pid === picked) ? picked : L.firstOpen(slots.map(s => ({ pid: s.pid, state: s.state })))
  const sheetSlot = sheet?.kind === 'set' || sheet?.kind === 'options' ? slots.find(s => s.pid === sheet.pid) : undefined
  const focusSlot = slots.find(s => s.pid === focus)

  const inFocus = view === 'train' && focusMode
  const showBar = !inFocus && (view === 'train' || !!t.active || rest.running || rest.ringing)
  const openFocus = (pid?: string) => { setPicked(pid); setFocusMode(true); window.scrollTo(0, 0) }

  if (!t.loaded) return <main className="app loading" aria-busy="true" />

  return (
    <main className={`app${showBar ? ' with-bar' : ''}${inFocus ? ' focus-mode' : ''}`}>
      <h1 className="sr-only">Calisthenics</h1>
      {view === 'data' && <DataView t={t} />}
      {view === 'history' && <HistoryView t={t} openActivity={date => setSheet({ kind: 'activity', date })} />}
      {view === 'train' && !focusMode && (
        <WorkoutView t={t} slots={slots} focus={focus} setFocus={setPicked} openFocus={openFocus}
          openActivity={() => setSheet({ kind: 'activity', date: t.today })} />
      )}
      {inFocus && (
        <FocusView t={t} rest={rest} slots={slots} slot={focusSlot}
          onBack={() => { setFocusMode(false); window.scrollTo(0, 0) }}
          onPick={pid => { setPicked(pid); window.scrollTo(0, 0) }}
          openSet={(pid, setNo) => setSheet({ kind: 'set', pid, setNo })}
          openOptions={pid => setSheet({ kind: 'options', pid })}
          onSaved={(s, setNo, summary) => {
            // letzter geplanter Satz → nach der Pause geht es mit der nächsten offenen Übung weiter
            if (L.nextSetNo({ sets: [...s.sets, { exercise: s.step.exercise.id, progression: s.pid, set: setNo, value: 0 }], planned: s.planned }) === null) setPicked(undefined)
            if (s.step.target.restSec > 0) setRestView(summary)
          }} />
      )}
      {inFocus && restView !== null && (rest.running || rest.ringing) && (
        <RestOverlay rest={rest} saved={restView} next={L.upNext(slots, focus)} onClose={() => setRestView(null)} />
      )}

      {/* unten, in Daumenreichweite: Session-Leiste (im Training immer, sonst nur während Session/Pause) über den Tabs */}
      {!inFocus && <div className="dock">
        {showBar && <BottomBar t={t} rest={rest} onStart={() => { t.startSession(); openFocus(undefined) }} />}
        <nav className="tabs" aria-label="Bereiche">
          {VIEWS.map(([k, l, icon]) => (
            <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined}
              onClick={() => { setView(k); window.scrollTo(0, 0) }}>
              <span className="tab-icon">
                <Icon name={icon} size={22} />
                {k === 'data' && <span className={`sync-dot ${syncDot(t.sync)}`} role="img" aria-label={syncLabel(t.sync)} />}
              </span>
              {l}
            </button>
          ))}
        </nav>
      </div>}

      {sheetSlot && sheet?.kind === 'set' && (
        <SetSheet key={`${sheet.pid}-${sheet.setNo}`} t={t} slot={sheetSlot} setNo={sheet.setNo} rest={rest}
          onClose={() => setSheet(null)}
          onSaved={() => {
            // letzte offene Satz-Nummer erfasst → Fokus wandert zur nächsten offenen Übung
            if (sheetSlot.sets.length + 1 >= sheetSlot.planned && !sheetSlot.sets.some(x => x.set === sheet.setNo)) setPicked(undefined)
            setSheet(null)
          }} />
      )}
      {sheetSlot && sheet?.kind === 'options' && <ExerciseSheet t={t} slot={sheetSlot} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'activity' && <ActivitySheet t={t} date={sheet.date} onClose={() => setSheet(null)} />}
    </main>
  )
}
