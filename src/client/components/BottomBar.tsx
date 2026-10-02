'use client'
import { useEffect, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'

/** Eine Zeile statt zwei: ohne Session nur „Workout starten“, mit Session links
    Workout + Dauer, rechts der Pausen-Timer bzw. drei Schnellstarts */
export function BottomBar({ t, rest }: { t: Training; rest: RestTimer }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!t.active) return
    setNow(Date.now())   // sonst rechnet die Anzeige bis zum ersten Tick mit dem Zeitpunkt vor dem Start
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [t.active])

  return (
    <footer className={`bar${rest.ringing ? ' alarm' : ''}`}>
      {!t.active ? (
        <>
          <button className="btn btn-primary grow" onClick={t.startSession}>▶ {t.ix.workouts.get(t.workout)!.name} starten</button>
          {(rest.running || rest.ringing) && <RestButton rest={rest} />}
        </>
      ) : (
        <>
          <button className="session" onClick={() => { if (confirm('Workout beenden und Zeit speichern?')) t.endSession() }} aria-label="Workout beenden">
            <span className="dot" aria-hidden="true" />
            <span className="session-name">{t.ix.workouts.get(t.active.workout)!.name}</span>
            <span className="session-time">{L.fmtDuration(Math.max(0, now - t.active.start) / 1000)}</span>
          </button>
          {rest.running || rest.ringing
            ? <RestButton rest={rest} />
            : <div className="presets">{[90, 120, 180].map(s => <button key={s} className="btn btn-secondary btn-sm" onClick={() => rest.start(s)}>{L.fmtClock(s)}</button>)}</div>}
        </>
      )}
    </footer>
  )
}

function RestButton({ rest }: { rest: RestTimer }) {
  return (
    <button className="btn btn-outline rest" onClick={rest.stop} aria-label="Pausen-Timer stoppen">
      {rest.ringing ? 'FERTIG' : L.fmtClock(rest.remaining)}
    </button>
  )
}
