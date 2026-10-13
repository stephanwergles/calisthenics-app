'use client'
/* Pause als eigener Screen: großer Ring, Feinjustierung, was als Nächstes kommt.
   „Los“ schließt nur die Ansicht – der Timer läuft weiter und klingelt trotzdem. */
import * as L from '../logic'
import type { RestTimer } from '../useRestTimer'
import { Icon } from './Icon'
import { ExerciseStill } from './ExerciseMedia'
import { t } from '../i18n'

const R = 132, C = 2 * Math.PI * R

export function RestOverlay({ rest, saved, next, onClose }: {
  rest: RestTimer
  saved: string | null
  next: { slot: L.SlotView; setNo: number } | null
  onClose: () => void
}) {
  const left = rest.ringing ? 0 : rest.remaining
  // aus dem exakten Rest, nicht aus ganzen Sekunden – der Ring läuft so flüssig statt in Stufen
  const share = rest.total && !rest.ringing ? Math.min(1, rest.remainingMs / (rest.total * 1000)) : 0
  return (
    <div className={`rest-screen${rest.ringing ? ' ringing' : ''}`} role="dialog" aria-modal="true" aria-label={t('training.rest.title')}>
      <div className="rs-top">
        <span className="rs-label">{rest.ringing || !rest.running ? t('training.rest.over') : t('training.rest.title')}</span>
        {saved && <span className="rs-saved"><Icon name="check" size={16} /> {saved}</span>}
      </div>

      <div className="rs-ring">
        <svg viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r={R} className="rs-track" />
          <circle cx="150" cy="150" r={R} className="rs-arc" strokeDasharray={`${(share * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 150 150)" />
        </svg>
        <div className="rs-center" role="timer" aria-live="off">
          <span className="num rs-time">{rest.ringing ? t('training.rest.goNow') : L.fmtClock(left)}</span>
          <span className="rs-of">{t('training.rest.of', { time: L.fmtClock(rest.total) })}</span>
        </div>
      </div>

      <div className="rs-adjust">
        <button className="btn btn-secondary" disabled={!rest.running} onClick={() => rest.shift(-15)}>−15 s</button>
        <button className="btn btn-secondary" disabled={!rest.running} onClick={() => rest.shift(30)}>+30 s</button>
        <button className="btn btn-outline" onClick={() => { rest.stop(); onClose() }}><Icon name="skip" /> {t('training.rest.go')}</button>
      </div>

      {next && (
        <button className="rs-next" onClick={onClose}>
          <span className="rs-next-label">{t('training.rest.next')}</span>
          <span className="rs-next-body">
            <ExerciseStill exercise={next.slot.step.exercise} className="rs-still" />
            <span>
              <b className="display">{t('training.rest.nextSet', { set: next.setNo, planned: next.slot.planned })}</b>
              <small>{t('training.rest.nextSub', { name: next.slot.step.exercise.name, target: next.slot.step.target.label })}</small>
            </span>
          </span>
        </button>
      )}
      <button className="btn btn-ghost btn-block" onClick={onClose}>{t('training.rest.back')}</button>
    </div>
  )
}
