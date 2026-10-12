'use client'
import { useEffect, useRef, useState } from 'react'
import type { RoutineItem } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'

interface Props {
  t: Training
  slots: L.SlotView[]
  focus: string | undefined
  setFocus: (pid: string | undefined) => void
  openSet: (pid: string, setNo: number) => void
  openActivity: () => void
}

export function WorkoutView({ t, slots, focus, setFocus, openSet, openActivity }: Props) {
  const w = t.ix.workouts.get(t.workout)!
  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length

  // Sobald trainiert wird, braucht die Wahl keinen Platz mehr – eine Zeile, aufklappbar
  const started = !!t.active || (t.todaySession?.sets.length ?? 0) > 0
  const [pickOpen, setPickOpen] = useState(false)
  const compact = started && !pickOpen

  return (
    <>
      {compact ? (
        <button className="wsel" onClick={() => setPickOpen(true)} aria-expanded={false}>
          <span className="display">{w.name}</span><span className="wsel-focus">{w.focus}</span>
          <span className="wsel-change">Wechseln <Icon name="down" size={16} /></span>
        </button>
      ) : (
        <div className="picker" role="group" aria-label="Workout wählen">
          {L.workoutsInWeekOrder(t.ix).map(x => (
            <button key={x.id} className={x.id === t.workout ? 'on' : ''} aria-pressed={x.id === t.workout}
              onClick={() => { t.chooseWorkout(x.id); setFocus(undefined); setPickOpen(false) }}>
              <span className="display">{x.name}</span>
              <small>{x.focus}</small>
              <em className={x.id === t.recommended ? 'rec' : ''}>{L.plannedDays(t.ix, x.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || '—'}</em>
            </button>
          ))}
        </div>
      )}
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
      <SessionNote key={`${t.today}-${t.workout}`} t={t} />
    </>
  )
}

function lastLine(s: L.SlotView) {
  if (!s.last) return null
  return `${L.fmtDate(s.last.date)}: ${s.last.sets.map(x => L.fmtSet(x, s.step.exercise)).join(' · ')}`
}

function Row({ s, onClick }: { s: L.SlotView; onClick: () => void }) {
  const mark = { open: null, done: <Icon name="check" size={14} />, skipped: <Icon name="minus" size={14} />, paused: <Icon name="pause" size={14} /> }[s.state]
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
          ? <button className="btn btn-ghost btn-sm" onClick={() => t.updateToday(x => L.withSkip(x, ex.id, false))}><Icon name="undo" size={16} /> Doch machen</button>
          : s.state !== 'paused' && s.state !== 'done' && <button className="btn btn-ghost btn-sm" onClick={() => t.updateToday(x => L.withSkip(x, ex.id, true))}>Überspringen</button>}
      </div>
      <h2>{ex.name}</h2>
      <p className="meta">
        <b>{step.target.label}</b> · Pause {L.fmtRest(step.target.restSec)}
        {ex.media.videoQuery && <> · <a className="tut" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.media.videoQuery)}`} target="_blank" rel="noopener"><Icon name="play" size={12} />Tutorial</a></>}
      </p>
      {lastLine(s) && <p className="last">Zuletzt {lastLine(s)}</p>}
      {s.last && L.notesOf(s.last.sets).map(n => (
        <p key={n.set} className="note-prev"><Icon name="note" size={14} /><span>Satz {n.set}: {n.note}</span></p>
      ))}

      {s.ready && step.next && (
        <button className="btn btn-outline btn-block unlock" onClick={() => setStep(step.next!.id)}><Icon name="up" /> Bereit für: {step.next.name}</button>
      )}

      {s.state === 'paused' ? (
        <button className="btn btn-secondary btn-block" onClick={() => t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== s.pid) }))}>Wieder aufnehmen</button>
      ) : (
        <div className="sets">
          {Array.from({ length: circles }, (_, i) => {
            const v = s.sets.find(x => x.set === i + 1)
            return (
              <button key={i} className={`set${v ? ' done' : ''}${v?.note ? ' has-note' : ''}`} aria-label={v ? `Satz ${i + 1}: ${L.fmtSet(v, ex)}${v.note ? `, Notiz: ${v.note}` : ''}` : `Satz ${i + 1} erfassen`} onClick={() => openSet(s.pid, i + 1)}>
                {v ? `${v.value}${v.weightKg ? `+${v.weightKg}` : ''}` : i + 1}
              </button>
            )
          })}
          <span className="adj">
            {s.planned > 1 && <button className="set small" aria-label="Einen Satz weniger" onClick={() => t.updateToday(x => L.withPlan(x, s.pid, s.planned - 1))}><Icon name="minus" size={16} /></button>}
            <button className="set small" aria-label="Einen Satz mehr" onClick={() => t.updateToday(x => L.withPlan(x, s.pid, s.planned + 1))}><Icon name="plus" size={16} /></button>
          </span>
        </div>
      )}

      <details className="technique">
        <summary><Icon name="right" size={16} className="chev" />Technik</summary>
        <dl>
          <dt>Ausgangsposition</dt><dd>{ex.technique.setup}</dd>
          <dt>Ausführung</dt><dd>{ex.technique.execution}</dd>
          <dt className="warn">Häufige Fehler</dt><dd>{ex.technique.faults}</dd>
          {ex.technique.scaling && <><dt>Leichter · Schwerer</dt><dd>{ex.technique.scaling}</dd></>}
        </dl>
        <div className="tech-actions">
          {step.prev && <button className="btn btn-secondary btn-sm" onClick={() => setStep(step.prev!.id)}><Icon name="left" size={16} /> {step.prev.name}</button>}
          {step.next && <button className="btn btn-outline btn-sm" onClick={() => setStep(step.next!.id)}>{step.next.name} <Icon name="right" size={16} /></button>}
          {s.state !== 'paused' && (
            <button className="btn btn-ghost btn-sm" onClick={() => t.setState(st => ({ ...st, paused: [...new Set([...st.paused, s.pid])] }))}><Icon name="pause" size={16} /> Übung pausieren</button>
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
      <summary><span>{title}</span><span className="count">{n}/{items.length}<Icon name="down" size={16} className="chev" /></span></summary>
      <ul>
        {items.map(it => (
          <li key={it.id}>
            <button className={`check${isDone(it) ? ' on' : ''}${it.cardio ? ' cardio' : ''}`} aria-pressed={isDone(it)}
              onClick={() => (it.cardio ? openActivity() : t.updateToday(s => L.withRoutine(s, it.id, !isDone(it))))}>
              <span className="box" aria-hidden="true">{isDone(it) && <Icon name="check" size={14} />}</span>
              <span><b>{it.name}</b>{it.cardio && todays.length
                ? todays.map(a => [L.activityTitle(a), L.fmtActivity(a)].filter(Boolean).join(' · ')).join(', ')
                : it.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Notiz zur ganzen Einheit – speichert 1,5 s nach dem letzten Tastendruck und beim Verlassen
    des Feldes, nicht bei jedem Zeichen (jede Speicherung ist eine Sync-Änderung) */
function SessionNote({ t }: { t: Training }) {
  const saved = t.todaySession?.note ?? ''
  const [text, setText] = useState(saved)
  const [open, setOpen] = useState(!!saved)
  const commit = () => { if ((L.cleanNote(text) ?? '') !== saved) t.updateToday(s => L.withNote(s, text)) }
  useEffect(() => {
    if ((L.cleanNote(text) ?? '') === saved) return
    const id = setTimeout(commit, 1500)
    return () => clearTimeout(id)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return (
    <button className="btn btn-ghost btn-block note-add" onClick={() => setOpen(true)}><Icon name="note" /> Notiz zur Einheit</button>
  )
  return (
    <div className="card note-card">
      <label className="field">
        <span className="field-label"><Icon name="note" size={16} /> Notiz zur Einheit</span>
        <textarea rows={3} maxLength={L.NOTE_MAX} value={text} placeholder="z. B. schlecht geschlafen, Schulter links zwickt"
          autoFocus={!saved} onChange={e => setText(e.target.value)} onBlur={commit} />
      </label>
    </div>
  )
}
