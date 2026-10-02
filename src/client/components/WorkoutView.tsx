'use client'
import { useEffect, useRef } from 'react'
import type { RoutineItem } from '@/domain/model'
import * as L from '../logic'
import { ix, type Training } from '../useTraining'

interface Props {
  t: Training
  slots: L.SlotView[]
  focus: string | undefined
  setFocus: (pid: string | undefined) => void
  openSet: (pid: string, setNo: number) => void
  openActivity: () => void
}

export function WorkoutView({ t, slots, focus, setFocus, openSet, openActivity }: Props) {
  const w = ix.workouts.get(t.workout)!
  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length

  return (
    <>
      <div className="picker" role="group" aria-label="Workout wählen">
        {L.workoutsInWeekOrder(ix).map(x => (
          <button key={x.id} className={x.id === t.workout ? 'on' : ''} aria-pressed={x.id === t.workout} onClick={() => { t.chooseWorkout(x.id); setFocus(undefined) }}>
            <span className="display">{x.name}</span>
            <small>{x.focus}</small>
            <em className={x.id === t.recommended ? 'rec' : ''}>{L.plannedDays(ix, x.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || '—'}</em>
          </button>
        ))}
      </div>
      <p className="wmeta">
        {counted.length} Übungen · {planned} Sätze{skipped ? ` · ${skipped} übersprungen` : ''}{paused ? ` · ${paused} pausiert` : ''}
      </p>
      <div className="progress" role="progressbar" aria-label="Sätze erledigt" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
        <i style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
      </div>

      <Routine t={t} title="Warm-up" items={w.warmup} openActivity={openActivity} />
      <ol className="slots">
        {slots.map(s => s.pid === focus
          ? <ActiveCard key={s.pid} t={t} s={s} openSet={openSet} />
          : <Row key={s.pid} s={s} onClick={() => setFocus(s.pid)} />)}
      </ol>
      <Routine t={t} title={w.cooldown.some(i => i.cardio) ? 'Cardio & Cool-down' : 'Cool-down & Dehnen'} items={w.cooldown} openActivity={openActivity} />
    </>
  )
}

function lastLine(s: L.SlotView) {
  if (!s.last) return null
  return `${L.fmtDate(s.last.date)}: ${s.last.sets.map(x => L.fmtSet(x, s.step.exercise)).join(' · ')}`
}

function Row({ s, onClick }: { s: L.SlotView; onClick: () => void }) {
  const mark = { open: '', done: '✓', skipped: '–', paused: '॥' }[s.state]
  const right = s.state === 'done' ? s.sets.map(x => x.value).join(' · ')
    : s.state === 'skipped' ? 'übersprungen' : s.state === 'paused' ? 'pausiert'
    : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label
  return (
    <li>
      <button className={`row ${s.state}`} onClick={onClick}>
        <span className="mark" aria-hidden="true">{mark}</span>
        <span className="row-main">
          <b>{s.step.exercise.name}</b>
          {s.state === 'open' && s.last && <small>Zuletzt {s.last.sets.map(x => x.value).join(' · ')}</small>}
          {s.ready && <small className="ready">bereit für die nächste Stufe</small>}
        </span>
        <span className="row-side">{right}</span>
      </button>
    </li>
  )
}

function ActiveCard({ t, s, openSet }: { t: Training; s: L.SlotView; openSet: (pid: string, setNo: number) => void }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [s.pid])
  const { step } = s, ex = step.exercise
  const circles = Math.max(s.planned, ...s.sets.map(x => x.set))
  const setStep = (id: string) => t.setState(st => ({ ...st, current: { ...st.current, [s.pid]: id } }))

  return (
    <li ref={ref} className={`card active ${s.state}`}>
      <div className="card-head">
        <span className="block-label">{L.BLOCK_LABEL[s.block]}{step.total > 1 && <span className="lvl"> · Stufe {step.index + 1}/{step.total}</span>}</span>
        {s.state === 'skipped'
          ? <button className="btn btn-ghost btn-sm" onClick={() => t.updateToday(x => L.withSkip(x, ex.id, false))}>↩ Doch machen</button>
          : s.state !== 'paused' && s.state !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => t.updateToday(x => L.withSkip(x, ex.id, true))}>Überspringen</button>}
      </div>
      <h2>{ex.name}</h2>
      <p className="meta">
        <b>{step.target.label}</b> · Pause {L.fmtRest(step.target.restSec)}
        {ex.media.videoQuery && <> · <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.media.videoQuery)}`} target="_blank" rel="noopener">▶ Tutorial</a></>}
      </p>
      {lastLine(s) && <p className="last">Zuletzt {lastLine(s)}</p>}

      {s.ready && step.next && (
        <button className="btn btn-outline btn-block unlock" onClick={() => setStep(step.next!.id)}>↑ Bereit für: {step.next.name}</button>
      )}

      {s.state === 'paused' ? (
        <button className="btn btn-secondary btn-block" onClick={() => t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== s.pid) }))}>Wieder aufnehmen</button>
      ) : (
        <div className="sets">
          {Array.from({ length: circles }, (_, i) => {
            const v = s.sets.find(x => x.set === i + 1)
            return (
              <button key={i} className={`set${v ? ' done' : ''}`} aria-label={v ? `Satz ${i + 1}: ${L.fmtSet(v, ex)}` : `Satz ${i + 1} erfassen`} onClick={() => openSet(s.pid, i + 1)}>
                {v ? `${v.value}${v.weightKg ? `+${v.weightKg}` : ''}` : i + 1}
              </button>
            )
          })}
          <span className="adj">
            {s.planned > 1 && <button className="set small" aria-label="Einen Satz weniger" onClick={() => t.updateToday(x => L.withPlan(x, s.pid, s.planned - 1))}>−</button>}
            <button className="set small" aria-label="Einen Satz mehr" onClick={() => t.updateToday(x => L.withPlan(x, s.pid, s.planned + 1))}>+</button>
          </span>
        </div>
      )}

      <details className="technique">
        <summary>Technik</summary>
        <dl>
          <dt>Ausgangsposition</dt><dd>{ex.technique.setup}</dd>
          <dt>Ausführung</dt><dd>{ex.technique.execution}</dd>
          <dt className="warn">Häufige Fehler</dt><dd>{ex.technique.faults}</dd>
          {ex.technique.scaling && <><dt>Leichter · Schwerer</dt><dd>{ex.technique.scaling}</dd></>}
        </dl>
        <div className="tech-actions">
          {step.prev && <button className="btn btn-secondary btn-sm" onClick={() => setStep(step.prev!.id)}>← {step.prev.name}</button>}
          {step.next && <button className="btn btn-outline btn-sm" onClick={() => setStep(step.next!.id)}>{step.next.name} →</button>}
          {s.state !== 'paused' && (
            <button className="btn btn-ghost btn-sm" onClick={() => t.setState(st => ({ ...st, paused: [...new Set([...st.paused, s.pid])] }))}>॥ Übung pausieren</button>
          )}
        </div>
      </details>
    </li>
  )
}

function Routine({ t, title, items, openActivity }: { t: Training; title: string; items: RoutineItem[]; openActivity: () => void }) {
  const doneIds = t.todaySession?.routineDone ?? []
  const todays = t.activities.filter(a => a.date === t.today)
  const isDone = (it: RoutineItem) => (it.cardio ? todays.length > 0 : doneIds.includes(it.id))
  const n = items.filter(isDone).length
  return (
    <details className={`card routine${n === items.length ? ' complete' : ''}`}>
      <summary><span>{title}</span><span className="count">{n}/{items.length}</span></summary>
      <ul>
        {items.map(it => (
          <li key={it.id}>
            <button className={`check${isDone(it) ? ' on' : ''}${it.cardio ? ' cardio' : ''}`} aria-pressed={isDone(it)}
              onClick={() => (it.cardio ? openActivity() : t.updateToday(s => L.withRoutine(s, it.id, !isDone(it))))}>
              <span className="box" aria-hidden="true">{isDone(it) ? '✓' : ''}</span>
              <span><b>{it.name}</b>{it.cardio && todays.length
                ? todays.map(a => `${a.kind === 'run' ? 'Lauf' : a.kind === 'ride' ? 'Rad' : a.name ?? 'Workout'} · ${a.durationMin ?? '?'} min${a.distanceKm ? ` · ${a.distanceKm} km` : ''}`).join(', ')
                : it.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
