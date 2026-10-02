'use client'
import { useEffect, useMemo, useState } from 'react'
import * as L from '../logic'
import { keepAwake } from '../signals'
import { ix, useTraining } from '../useTraining'
import { useRestTimer } from '../useRestTimer'
import { BottomBar } from './BottomBar'
import { DataView } from './DataView'
import { ActivitySheet, SetSheet } from './Sheets'
import { WorkoutView } from './WorkoutView'

type SheetState = { kind: 'set'; pid: string; setNo: number } | { kind: 'activity' } | null

export function TrainingApp() {
  const t = useTraining()
  const rest = useRestTimer()
  const [view, setView] = useState<'train' | 'data'>('train')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [picked, setPicked] = useState<string | undefined>()

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
    () => (t.loaded ? L.workoutSlots(ix, t.workout, t.state, t.todaySession, t.sessions, t.today) : []),
    [t.loaded, t.workout, t.state, t.todaySession, t.sessions, t.today],
  )
  // Fokus: ausgewählte Übung, sonst die erste offene
  const focus = picked && slots.some(s => s.pid === picked) ? picked : L.firstOpen(slots.map(s => ({ pid: s.pid, state: s.state })))
  const sheetSlot = sheet?.kind === 'set' ? slots.find(s => s.pid === sheet.pid) : undefined

  if (!t.loaded) return <main className="app loading" aria-busy="true" />

  return (
    <main className="app">
      <header className="top">
        <h1 className="display">Calisthenics</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => setView(view === 'train' ? 'data' : 'train')}>
          {view === 'train' ? 'Daten' : '← Training'}
        </button>
      </header>

      {view === 'data' ? <DataView t={t} /> : (
        <WorkoutView t={t} slots={slots} focus={focus} setFocus={setPicked}
          openSet={(pid, setNo) => setSheet({ kind: 'set', pid, setNo })}
          openActivity={() => setSheet({ kind: 'activity' })} />
      )}

      {view === 'train' && <BottomBar t={t} rest={rest} />}

      {sheetSlot && sheet?.kind === 'set' && (
        <SetSheet key={`${sheet.pid}-${sheet.setNo}`} t={t} slot={sheetSlot} setNo={sheet.setNo} rest={rest}
          onClose={() => setSheet(null)}
          onSaved={() => {
            // letzte offene Satz-Nummer erfasst → Fokus wandert zur nächsten offenen Übung
            if (sheetSlot.sets.length + 1 >= sheetSlot.planned && !sheetSlot.sets.some(x => x.set === sheet.setNo)) setPicked(undefined)
            setSheet(null)
          }} />
      )}
      {sheet?.kind === 'activity' && <ActivitySheet t={t} onClose={() => setSheet(null)} />}
    </main>
  )
}
