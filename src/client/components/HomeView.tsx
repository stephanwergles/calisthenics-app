'use client'
/* Startseite „Heute“: die Woche auf einen Blick, das Workout des Tages als große Karte,
   darunter die Skills mit dem kürzesten Weg zur nächsten Stufe. */
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sketch } from './Sketch'

const R = 22, C = 2 * Math.PI * R

export function HomeView({ t, slots, onStart, onBrowse, onSkills }: {
  t: Training; slots: L.SlotView[]; onStart: () => void; onBrowse: () => void; onSkills: () => void
}) {
  const w = t.ix.workouts.get(t.workout)!
  const [picking, setPicking] = useState(false)
  const week = useMemo(() => L.weekStrip(t.ix, t.sessions, t.activities, t.today), [t.ix, t.sessions, t.activities, t.today])
  const streak = useMemo(() => L.streakWeeks(t.sessions, t.today), [t.sessions, t.today])
  const minutes = useMemo(() => L.estimateMinutes(t.sessions, t.workout), [t.sessions, t.workout])
  const skills = useMemo(() => L.nextSkills(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])

  const active = slots.filter(s => s.state !== 'paused' && s.state !== 'skipped')
  const sets = active.reduce((n, s) => n + s.planned, 0)
  const [first, ...rest] = w.focus.split(' · ')
  const hero = active[0]?.step.exercise
  const dateLabel = new Date(`${t.today}T12:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section className="home">
      <header className="h-head">
        <div>
          <span className="h-date">{dateLabel}</span>
          <h2 className="display h-title">Bereit für<br /><span className="accent">{first}.</span></h2>
        </div>
        {streak > 0 && (
          <div className="h-streak">
            <span className="num">{streak}</span>
            <small>{streak === 1 ? 'Woche' : 'Wochen'} in Serie</small>
          </div>
        )}
      </header>

      <ol className="h-week" aria-label="Diese Woche">
        {week.map(d => (
          <li key={d.date} className={['h-day', d.trained && 'trained', d.today && 'today', d.planned && 'planned', d.cardio && 'cardio'].filter(Boolean).join(' ')}
            aria-label={`${d.label}${d.trained ? ', trainiert' : d.planned ? ', geplant' : ''}${d.cardio ? ', Cardio' : ''}${d.today ? ', heute' : ''}`}>
            <small>{d.label}</small>
            <span className="num">{d.trained ? <Icon name="check" size={16} /> : Number(d.date.slice(8))}</span>
          </li>
        ))}
      </ol>

      <div className="h-hero">
        {hero && <Sketch id={hero.media.sketch} label="" />}
        <span className="h-label">Heute · {w.name}</span>
        <h3 className="display h-focus">{first}{rest.length > 0 && <><br />{rest.join(' · ')}</>}</h3>
        <p className="h-meta">{active.length} Übungen · {sets} Sätze{minutes ? ` · ca. ${minutes} min` : ''}</p>
        <ul className="h-chips">
          {active.slice(0, 3).map(s => <li key={s.pid}>{s.step.exercise.name}</li>)}
          {active.length > 3 && <li className="more">+{active.length - 3}</li>}
        </ul>
        <button className="btn btn-primary btn-block f-cta" onClick={onStart}><Icon name="play" size={20} /> Training starten</button>
        <div className="h-links">
          <button className="btn btn-ghost btn-sm" onClick={onBrowse}><Icon name="list" size={16} /> Übungen ansehen</button>
          <button className="btn btn-ghost btn-sm" aria-expanded={picking} onClick={() => setPicking(p => !p)}>Anderes Workout <Icon name="down" size={16} className={picking ? 'flip' : ''} /></button>
        </div>
        {picking && (
          <div className="picker" role="group" aria-label="Workout wählen">
            {L.workoutsInWeekOrder(t.ix).map(x => (
              <button key={x.id} className={x.id === t.workout ? 'on' : ''} aria-pressed={x.id === t.workout} onClick={() => { t.chooseWorkout(x.id); setPicking(false) }}>
                <span className="display">{x.name}</span>
                <small>{x.focus}</small>
                <em className={x.id === t.recommended ? 'rec' : ''}>{L.plannedDays(t.ix, x.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || '—'}</em>
              </button>
            ))}
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div className="h-skills">
          <div className="h-skills-head">
            <h3 className="display">Nächste Skills</h3>
            <button className="btn btn-ghost btn-sm" onClick={onSkills}>Skill-Tree <Icon name="right" size={16} /></button>
          </div>
          <div className="h-skill-grid">
            {skills.map(s => {
              const pct = Math.round(s.readiness * 100)
              return (
                <div key={s.pid} className="h-skill">
                  <svg viewBox="0 0 52 52" role="img" aria-label={`${pct} Prozent bereit für ${s.step.next!.name}`}>
                    <circle cx="26" cy="26" r={R} className="ring-track" />
                    <circle cx="26" cy="26" r={R} className="ring-arc" strokeDasharray={`${(s.readiness * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 26 26)" />
                    <text x="26" y="31" textAnchor="middle">{pct}%</text>
                  </svg>
                  <span>
                    <b className="display">{s.step.next!.name}</b>
                    <small>jetzt {s.step.exercise.name} · {s.step.index + 1}/{s.step.total}</small>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
