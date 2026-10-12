'use client'
import { useEffect, useState } from 'react'
import type { RoutineItem } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'

interface Props {
  t: Training
  slots: L.SlotView[]
  focus: string | undefined
  openFocus: (pid: string) => void
  onHome?: () => void
  openActivity: () => void
}

export function WorkoutView({ t, slots, focus, openFocus, onHome, openActivity }: Props) {
  const w = t.ix.workouts.get(t.workout)!
  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length

  return (
    <>
      <header className="ov-head">
        {onHome && <button className="btn btn-ghost btn-icon" aria-label="Zurück zu Heute" onClick={onHome}><Icon name="left" size={20} /></button>}
        <div>
          <span className="h-label">Übungen · {w.name}</span>
          <h2 className="display ov-title">{w.focus}</h2>
        </div>
      </header>
      <p className="wmeta">
        {counted.length} Übungen · {planned} Sätze{skipped ? ` · ${skipped} übersprungen` : ''}{paused ? ` · ${paused} pausiert` : ''}
      </p>
      <div className="progress" role="progressbar" aria-label="Sätze erledigt" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
        <i style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
      </div>

      <Routine t={t} title="Warm-up" items={w.warmup} openActivity={openActivity} />
      <ol className="slots">
        {slots.map(s => <Row key={s.pid} s={s} next={s.pid === focus} onClick={() => openFocus(s.pid)} />)}
      </ol>
      <Routine t={t} title={w.cooldown.some(i => i.cardio) ? 'Cardio & Cool-down' : 'Cool-down & Dehnen'} items={w.cooldown} openActivity={openActivity} />
      <SessionNote key={`${t.today}-${t.workout}`} t={t} />
    </>
  )
}

function Row({ s, next, onClick }: { s: L.SlotView; next: boolean; onClick: () => void }) {
  const mark = { open: null, done: <Icon name="check" size={14} />, skipped: <Icon name="minus" size={14} />, paused: <Icon name="pause" size={14} /> }[s.state]
  const right = s.state === 'done' ? s.sets.map(x => x.value).join(' · ')
    : s.state === 'skipped' ? 'übersprungen' : s.state === 'paused' ? 'pausiert'
    : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label
  return (
    <li>
      <button className={`row ${s.state}${next ? ' next' : ''}`} onClick={onClick}>
        <span className="mark" aria-hidden="true">{mark}</span>
        <span className="row-main">
          {next && <small className="next-label">Als Nächstes</small>}
          <b>{s.step.exercise.name}</b>
          {s.state === 'open' && s.last && <small>Zuletzt {s.last.sets.map(x => x.value).join(' · ')}</small>}
          {s.ready && <small className="ready">bereit für die nächste Stufe</small>}
        </span>
        <span className="row-side">{right}</span>
      </button>
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
