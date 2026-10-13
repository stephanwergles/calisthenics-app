'use client'
/* Startseite „Heute“: die Woche auf einen Blick, das Workout des Tages als große Karte,
   darunter die Skills mit dem kürzesten Weg zur nächsten Stufe. */
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Wordmark } from './LeverMark'
import { ExerciseStill, hasClip } from './ExerciseMedia'

const R = 22, C = 2 * Math.PI * R

export function HomeView({ t, slots, started, done, onStart, onSummary, onBrowse, onSkills, onManage }: {
  t: Training; slots: L.SlotView[]; started: boolean; done: boolean
  onStart: () => void; onSummary?: () => void; onBrowse: () => void; onSkills: () => void; onManage: () => void
}) {
  const w = t.ix.workouts.get(t.workout)!
  const [picking, setPicking] = useState(false)
  const week = useMemo(() => L.weekStrip(t.ix, t.sessions, t.activities, t.today), [t.ix, t.sessions, t.activities, t.today])
  const streak = useMemo(() => L.streakWeeks(t.sessions, t.today, t.state.phases), [t.sessions, t.today, t.state.phases])
  const resting = L.restingPhase(t.state, t.today)
  const blocked = slots.filter(s => s.blockedBy)
  const notice = resting ? `${L.fmtPhase(resting)} – heute ist nichts fällig, deine Serie bleibt.`
    : blocked.length ? `${blocked.length} ${blocked.length === 1 ? 'Übung ruht' : 'Übungen ruhen'} heute (${[...new Set(blocked.map(s => s.blockedBy))].join(', ')}).`
    : L.reentry(t.state, t.today) ? 'Wiedereinstieg nach der Pause: diese Woche je Übung ein Satz weniger.' : null
  const minutes = useMemo(() => L.estimateMinutes(t.sessions, t.workout), [t.sessions, t.workout])
  const skills = useMemo(() => L.nextSkills(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  // Ziel der Leiter (letzte Stufe) – zeigt, wohin es geht, statt nur die nächste Stufe
  const goalOf = (pid: string) => { const st = t.ix.progressions.get(pid)?.steps; return st ? t.ix.exercises.get(st[st.length - 1].exercise)?.name ?? '' : '' }

  const active = slots.filter(s => s.state !== 'paused' && s.state !== 'skipped')
  const sets = active.reduce((n, s) => n + s.planned, 0)
  const [first, ...rest] = w.focus.split(' · ')
  // Bild im Hero: erste Übung des Tages mit 3D-Clip, sonst die erste mit Skizze
  const hero = (active.find(s => hasClip(s.step.exercise.id)) ?? active[0])?.step.exercise
  const dateLabel = new Date(`${t.today}T12:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const doneSets = active.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const cta = t.active ? 'Weiter trainieren' : done ? 'Noch eine Runde' : started ? 'Training fortsetzen' : 'Training starten'

  return (
    <section className="home">
      <Wordmark className="brand-word" />
      <header className="h-head">
        <div>
          <span className="h-date">{dateLabel}</span>
          <h2 className="display h-title">{done ? <>Heute<br /><span className="accent">erledigt.</span></> : t.active ? <>Weiter mit<br /><span className="accent">{first}.</span></> : <>Bereit für<br /><span className="accent">{first}.</span></>}</h2>
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

      {notice && <p className="h-notice" role="status">{notice}</p>}

      <div className="h-hero">
        {hero && <ExerciseStill exercise={hero} className="h-still" />}
        <span className="h-label">Heute · {w.name}{started ? ` · ${doneSets}/${sets} Sätze` : ''}</span>
        <h3 className="display h-focus">{first}{rest.length > 0 && <><br />{rest.join(' · ')}</>}</h3>
        {!started && <p className="h-meta">{active.length} Übungen · {sets} Sätze{minutes ? ` · ca. ${minutes} min` : ''}</p>}
        <ul className="h-chips">
          {active.slice(0, 3).map(s => <li key={s.pid}>{s.step.exercise.name}</li>)}
          {active.length > 3 && <li className="more">+{active.length - 3}</li>}
        </ul>
        {done && onSummary
          ? <button className="btn btn-primary btn-block f-cta" onClick={onSummary}><Icon name="trophy" size={20} /> Abschluss ansehen</button>
          : <button className="btn btn-primary btn-block f-cta" onClick={onStart}><Icon name="play" size={20} /> {cta}</button>}
        {done && <button className="btn btn-secondary btn-block" onClick={onStart}><Icon name="play" size={18} /> {cta}</button>}
        <div className="h-links">
          <button className="btn btn-ghost btn-sm" onClick={onBrowse}><Icon name="list" size={16} /> Übungen</button>
          <button className="btn btn-ghost btn-sm" aria-expanded={picking} onClick={() => setPicking(p => !p)}>Tauschen <Icon name="down" size={16} className={picking ? 'flip' : ''} /></button>
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
            <button className="manage" onClick={() => { setPicking(false); onManage() }}>
              <span className="display">Im Plan bearbeiten</span>
              <small>Eigene Workouts, Übungen und Wochentage</small>
              <em><Icon name="right" size={16} /></em>
            </button>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div className="h-skills">
          <div className="h-skills-head">
            <h3 className="display">Nächste Skills</h3>
            <button className="btn btn-ghost btn-sm" onClick={onSkills}>Alle Skills <Icon name="right" size={16} /></button>
          </div>
          <div className="h-skill-grid">
            {skills.map(s => {
              const pct = Math.round(s.readiness * 100)
              const prog = L.unlockProgress(t.sessions, s.step.exercise.id, s.step.target, s.step.nextTarget)
              const ready = !!prog && prog.done >= prog.needed
              return (
                <div key={s.pid} className={`h-skill${ready ? ' ready' : ''}`}>
                  <svg viewBox="0 0 52 52" role="img" aria-label={ready ? `Bereit für ${s.step.next!.name}` : `${pct} Prozent bereit für ${s.step.next!.name}`}>
                    <circle cx="26" cy="26" r={R} className="ring-track" />
                    {s.readiness > 0 && <circle cx="26" cy="26" r={R} className="ring-arc" strokeDasharray={`${(s.readiness * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 26 26)" />}
                    {ready
                      ? <path d="M17 26.5l6 6 12-13" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="ring-check" />
                      : <text x="26" y="31" textAnchor="middle">{pct}%</text>}
                  </svg>
                  <span>
                    <b className="display">{goalOf(s.pid)}</b>
                    <small>{ready
                      ? `Bereit für ${s.step.next!.name}`
                      : `${s.step.exercise.name} · Stufe ${s.step.index + 1}/${s.step.total} · ${prog?.done ?? 0} von 2`}</small>
                  </span>
                  {ready && (
                    <button className="btn btn-outline btn-sm" onClick={() => t.setState(st => ({ ...st, current: { ...st.current, [s.pid]: s.step.next!.id } }))}>
                      Freischalten
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
