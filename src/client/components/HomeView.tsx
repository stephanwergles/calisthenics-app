'use client'
/* Startseite „Heute“: die Woche auf einen Blick, das Workout des Tages als große Karte,
   darunter die Skills mit dem kürzesten Weg zur nächsten Stufe. */
import { useMemo, useState } from 'react'
import * as L from '@/core/logic'
import type { Training } from '@/core/useTraining'
import { Icon } from './Icon'
import { Wordmark } from './LeverMark'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { intl, t as tr, tn, getLocale } from '@/core/i18n'

const R = 22, C = 2 * Math.PI * R

export function HomeView({ t, slots, started, done, onStart, onSummary, onBrowse, onSkills, onManage }: {
  t: Training; slots: L.SlotView[]; started: boolean; done: boolean
  onStart: () => void; onSummary?: () => void; onBrowse: () => void; onSkills: () => void; onManage: () => void
}) {
  const w = t.ix.workouts.get(t.workout)!
  const [picking, setPicking] = useState(false)
  const week = useMemo(() => L.weekStrip(t.ix, t.sessions, t.activities, t.today), [t.ix, t.sessions, t.activities, t.today, getLocale()])
  const streak = useMemo(() => L.streakWeeks(t.sessions, t.today, t.state.phases), [t.sessions, t.today, t.state.phases])
  const resting = L.restingPhase(t.state, t.today)
  const blocked = slots.filter(s => s.blockedBy)
  const subs = slots.filter(s => s.substituteFor).length
  const notice = resting ? tr('home.noticeResting', { phase: L.fmtPhase(resting) })
    : blocked.length ? tn('home.noticeBlocked', blocked.length, { reasons: [...new Set(blocked.map(s => s.blockedBy))].join(', ') })
      + (subs ? (subs === blocked.length ? tr('home.noticeSubsAll') : tr('home.noticeSubsSome', { n: subs })) : '.')
    : L.reentry(t.state, t.today) ? tr('home.noticeReentry') : null
  const minutes = useMemo(() => L.estimateMinutes(t.sessions, t.workout), [t.sessions, t.workout])
  const skills = useMemo(() => L.nextSkills(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, getLocale()])
  // Ziel der Leiter (letzte Stufe) – zeigt, wohin es geht, statt nur die nächste Stufe
  const goalOf = (pid: string) => L.progressionName(t.ix, pid)

  const active = slots.filter(s => s.state !== 'paused' && s.state !== 'skipped')
  const sets = active.reduce((n, s) => n + s.planned, 0)
  const [first, ...rest] = w.focus.split(' · ')
  // Bild im Hero: erste Übung des Tages mit 3D-Clip, sonst die erste mit Skizze
  const hero = (active.find(s => hasClip(s.step.exercise.id)) ?? active[0])?.step.exercise
  const dateLabel = new Date(`${t.today}T12:00`).toLocaleDateString(intl(), { weekday: 'long', day: 'numeric', month: 'long' })
  const doneSets = active.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const cta = t.active ? tr('home.ctaActive') : done ? tr('home.ctaAgain') : started ? tr('home.ctaResume') : tr('home.ctaStart')

  return (
    <section className="home">
      <Wordmark className="brand-word" />
      <header className="h-head">
        <div>
          <span className="h-date">{dateLabel}</span>
          <h2 className="display h-title">{done ? <>{tr('home.titleDone')}<br /><span className="accent">{tr('home.titleDoneAccent')}</span></> : t.active ? <>{tr('home.titleActive')}<br /><span className="accent">{first}.</span></> : <>{tr('home.titleReady')}<br /><span className="accent">{first}.</span></>}</h2>
        </div>
        {streak > 0 && (
          <div className="h-streak">
            <span className="num">{streak}</span>
            <small>{tn('home.streak', streak)}</small>
          </div>
        )}
      </header>

      <ol className="h-week" aria-label={tr('home.weekAria')}>
        {week.map(d => (
          <li key={d.date} className={['h-day', d.trained && 'trained', d.today && 'today', d.planned && 'planned', d.cardio && 'cardio'].filter(Boolean).join(' ')}
            aria-label={`${d.label}${d.trained ? tr('home.dayTrained') : d.planned ? tr('home.dayPlanned') : ''}${d.cardio ? tr('home.dayCardio') : ''}${d.today ? tr('home.dayToday') : ''}`}>
            <small>{d.label}</small>
            <span className="num">{d.trained ? <Icon name="check" size={16} /> : Number(d.date.slice(8))}</span>
          </li>
        ))}
      </ol>

      {notice && <p className="h-notice" role="status">{notice}</p>}

      <div className="h-hero">
        {hero && <ExerciseStill exercise={hero} className="h-still" />}
        <span className="h-label">{tr('home.heroLabel', { name: w.name })}{started ? tr('home.heroSets', { done: doneSets, total: sets }) : ''}</span>
        <h3 className="display h-focus">{first}{rest.length > 0 && <><br />{rest.join(' · ')}</>}</h3>
        {!started && <p className="h-meta">{tn('home.meta.exercises', active.length)} · {tn('home.meta.sets', sets)}{minutes ? tr('home.metaMinutes', { n: minutes }) : ''}</p>}
        <ul className="h-chips">
          {active.slice(0, 3).map(s => <li key={s.pid}>{s.step.exercise.name}</li>)}
          {active.length > 3 && <li className="more">+{active.length - 3}</li>}
        </ul>
        {done && onSummary
          ? <button className="btn btn-primary btn-block f-cta" onClick={onSummary}><Icon name="trophy" size={20} /> {tr('home.summary')}</button>
          : <button className="btn btn-primary btn-block f-cta" onClick={onStart}><Icon name="play" size={20} /> {cta}</button>}
        {done && <button className="btn btn-secondary btn-block" onClick={onStart}><Icon name="play" size={18} /> {cta}</button>}
        <div className="h-links">
          <button className="btn btn-ghost btn-sm" onClick={onBrowse}><Icon name="list" size={16} /> {tr('home.exercises')}</button>
          <button className="btn btn-ghost btn-sm" aria-expanded={picking} onClick={() => setPicking(p => !p)}>{tr('home.swap')} <Icon name="down" size={16} className={picking ? 'flip' : ''} /></button>
        </div>
        {picking && (
          <div className="picker" role="group" aria-label={tr('home.pickAria')}>
            {L.workoutsInWeekOrder(t.ix).map(x => (
              <button key={x.id} className={x.id === t.workout ? 'on' : ''} aria-pressed={x.id === t.workout} onClick={() => { t.chooseWorkout(x.id); setPicking(false) }}>
                <span className="display">{x.name}</span>
                <small>{x.focus}</small>
                <em className={x.id === t.recommended ? 'rec' : ''}>{L.plannedDays(t.ix, x.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || '—'}</em>
              </button>
            ))}
            <button className="manage" onClick={() => { setPicking(false); onManage() }}>
              <span className="display">{tr('home.manage')}</span>
              <small>{tr('home.manageSub')}</small>
              <em><Icon name="right" size={16} /></em>
            </button>
          </div>
        )}
      </div>

      {skills.length > 0 && (
        <div className="h-skills">
          <div className="h-skills-head">
            <h3 className="display">{tr('home.nextSkills')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={onSkills}>{tr('home.allSkills')} <Icon name="right" size={16} /></button>
          </div>
          <div className="h-skill-grid">
            {skills.map(s => {
              const pct = Math.round(s.readiness * 100)
              const prog = L.unlockProgress(t.sessions, s.step.exercise.id, s.step.target, s.step.nextTarget)
              const ready = !!prog && prog.done >= prog.needed
              return (
                <div key={s.pid} className={`h-skill${ready ? ' ready' : ''}`}>
                  <svg viewBox="0 0 52 52" role="img" aria-label={ready ? tr('home.readyFor', { name: s.step.next!.name }) : tr('home.readyPct', { pct, name: s.step.next!.name })}>
                    <circle cx="26" cy="26" r={R} className="ring-track" />
                    {s.readiness > 0 && <circle cx="26" cy="26" r={R} className="ring-arc" strokeDasharray={`${(s.readiness * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 26 26)" />}
                    {ready
                      ? <path d="M17 26.5l6 6 12-13" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="ring-check" />
                      : <text x="26" y="31" textAnchor="middle">{pct}%</text>}
                  </svg>
                  <span>
                    <b className="display">{goalOf(s.pid)}</b>
                    <small>{ready
                      ? tr('home.readyFor', { name: s.step.next!.name })
                      : tr('home.skillProgress', { exercise: s.step.exercise.name, stage: s.step.index + 1, total: s.step.total, done: prog?.done ?? 0 })}</small>
                  </span>
                  {ready && (
                    <button className="btn btn-outline btn-sm" onClick={() => t.setState(st => ({ ...st, current: { ...st.current, [s.pid]: s.step.next!.id } }))}>
                      {tr('home.unlock')}
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
