'use client'
import { useEffect, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'
import { Icon } from './Icon'
import { ask } from '../native'
import { t as tr } from '../i18n'

/** Eine Zeile: ohne Session nur „Workout starten“. Mit Session links Dauer + Workout (Tipp öffnet
    das Training), rechts außen Beenden. Während einer Pause stattdessen Timer + drei Längen zum Umschalten. */
export function BottomBar({ t, rest, onStart, onStop, onOpen }: { t: Training; rest: RestTimer; onStart: () => void; onStop: () => void; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!t.active) return
    setNow(Date.now())   // sonst rechnet die Anzeige bis zum ersten Tick mit dem Zeitpunkt vor dem Start
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [t.active])

  return (
    <div className={`bar${rest.ringing ? ' alarm' : ''}${!t.active ? ' start' : ''}`}>
      {!t.active ? (
        <>
          <button className="btn btn-primary grow bar-start" onClick={onStart}><Icon name="play" size={20} /> {tr('training.bar.start', { name: t.ix.workouts.get(t.workout)!.name })}</button>
          {(rest.running || rest.ringing) && <RestButton rest={rest} />}
        </>
      ) : (
        <>
          {rest.running || rest.ringing ? (
            <>
              <RestButton rest={rest} />
              {rest.running && <div className="presets">{[90, 120, 180].map(s => (
                <button key={s} className={`btn btn-secondary btn-sm${rest.total === s ? ' on' : ''}`} aria-pressed={rest.total === s} onClick={() => rest.start(s)}>{L.fmtClock(s)}</button>
              ))}</div>}
            </>
          ) : (
            <button className="session" onClick={onOpen} title={tr('training.bar.open')}>
              <span className="dot" aria-hidden="true" />
              <span className="session-info">
                <span className="session-time">{L.fmtDuration(Math.max(0, now - t.active.start) / 1000)}</span>
                <span className="session-name">{t.ix.workouts.get(t.active.workout)?.name ?? tr('training.bar.fallback')}</span>
              </span>
              <Icon name="right" size={18} />
            </button>
          )}
          <button className="btn btn-secondary btn-icon stop" onClick={async () => { if (await ask({ title: tr('training.bar.stopTitle'), message: tr('training.bar.stopMessage'), ok: tr('training.bar.stopOk') })) onStop() }} aria-label={tr('training.bar.stop')}>
            <Icon name="stop" size={16} />
          </button>
        </>
      )}
    </div>
  )
}

function RestButton({ rest }: { rest: RestTimer }) {
  return (
    <button className="btn btn-outline rest" onClick={rest.stop} aria-label={tr('training.bar.stopRest')}>
      {rest.ringing ? tr('training.bar.ringing') : <><Icon name="timer" size={18} />{L.fmtClock(rest.remaining)}</>}
    </button>
  )
}
