'use client'
import { useEffect, useRef, useState } from 'react'
import type { RoutineItem } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import type { NBlock } from '../native'

interface Props {
  t: Training
  slots: L.SlotView[]
  focus: string | undefined
  openFocus: (pid: string) => void
  openActivity: () => void
  onClose: () => void
  /** ohne laufende Session: Start-Button in der Fußzeile */
  onStart?: () => void
}

/** Übungsplan des Tages als großes Sheet – vor dem Start als Vorschau, im Training als Liste zum Springen */
export function PlanSheet({ t, slots, focus, openFocus, openActivity, onClose, onStart }: Props) {
  const w = t.ix.workouts.get(t.workout)!
  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length
  const sub = `${w.name} · ${counted.length} Übungen · ${planned} Sätze${skipped ? ` · ${skipped} übersprungen` : ''}${paused ? ` · ${paused} pausiert` : ''}`

  // iOS-App: als natives Sheet (gleiche Inhalte, echte Bedienelemente)
  const native = useNativeShell()
  const [openR, setOpenR] = useState<Record<string, boolean>>({})
  const note = useNoteSaver(t)
  const todays = t.activities.filter(a => a.date === t.today)
  const doneIds = t.todaySession?.routineDone ?? []
  const isDone = (it: RoutineItem) => (it.cardio ? todays.length > 0 : doneIds.includes(it.id))
  const routineBlocks = (key: string, title: string, items: RoutineItem[]): NBlock[] => [
    { type: 'disclosure', id: `open:${key}`, title, trailing: `${items.filter(isDone).length}/${items.length}`, on: !!openR[key] },
    ...(openR[key] ? items.map((it): NBlock => ({ type: 'check', id: `${it.cardio ? 'cardio' : 'rt'}:${it.id}`, title: it.name, subtitle: it.detail, on: isDone(it) })) : []),
  ]
  const cool = w.cooldown.some(i => i.cardio) ? 'Cardio & Cool-down' : 'Cool-down & Dehnen'
  useNativeSheet(native ? {
    id: 'plan', title: w.focus, subtitle: sub, detents: ['medium', 'large'],
    blocks: [
      ...(done > 0 ? [{ type: 'segments', done, total: planned } as NBlock] : []),
      ...routineBlocks('warm', 'Warm-up', w.warmup),
      ...slots.map((s): NBlock => ({
        type: 'row', id: `ex:${s.pid}`, title: s.step.exercise.name,
        eyebrow: s.pid === focus && s.state === 'open' ? 'Als Nächstes' : undefined,
        subtitle: [s.state === 'open' && s.last ? `Zuletzt ${s.last.sets.map(x => x.value).join(' · ')}` : null, s.ready ? 'bereit für die nächste Stufe' : null].filter(Boolean).join(' · ') || undefined,
        trailing: s.state === 'done' ? s.sets.map(x => x.value).join(' · ') : s.state === 'skipped' ? 'übersprungen' : s.state === 'paused' ? 'pausiert'
          : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label,
        state: s.pid === focus && s.state === 'open' ? 'next' : s.state,
        clip: hasClip(s.step.exercise.id) ? s.step.exercise.id : undefined,
      })),
      ...routineBlocks('cool', cool, w.cooldown),
      { type: 'field', id: 'note', label: 'Notiz zur Einheit', value: t.todaySession?.note ?? '', placeholder: 'z. B. schlecht geschlafen, Schulter links zwickt' },
    ],
    footer: onStart ? [{ id: 'start', title: `${w.name} starten`, symbol: 'play.fill', style: 'prominent' }] : undefined,
  } : null, e => {
    if (e.type === 'dismiss') { note.flush(); onClose() }
    else if (e.type === 'text' && e.id === 'note') note.change(String(e.value ?? ''))
    else if (e.type === 'toggle' && e.id?.startsWith('open:')) { const k = e.id.slice(5); setOpenR(o => ({ ...o, [k]: !o[k] })) }
    else if (e.type === 'toggle' && e.id?.startsWith('rt:')) t.updateToday(x => L.withRoutine(x, e.id!.slice(3), !!e.value))
    else if (e.type === 'toggle' && e.id?.startsWith('cardio:')) openActivity()
    else if (e.type === 'tap' && e.id?.startsWith('ex:')) { note.flush(); openFocus(e.id.slice(3)) }
    else if (e.type === 'tap' && e.id === 'start') { note.flush(); onStart?.() }
  })
  if (native) return null

  return (
    <Sheet large title={w.focus} onClose={onClose}
      sub={sub}
      footer={onStart && <button className="btn btn-primary btn-block bar-start" onClick={onStart}><Icon name="play" size={20} /> {w.name} starten</button>}>
      {done > 0 && (
        <div className="progress" role="progressbar" aria-label="Sätze erledigt" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
          <i style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
        </div>
      )}
      <Routine t={t} title="Warm-up" items={w.warmup} openActivity={openActivity} />
      <ol className="slots">
        {slots.map(s => <Row key={s.pid} s={s} next={s.pid === focus} onClick={() => openFocus(s.pid)} />)}
      </ol>
      <Routine t={t} title={w.cooldown.some(i => i.cardio) ? 'Cardio & Cool-down' : 'Cool-down & Dehnen'} items={w.cooldown} openActivity={openActivity} />
      <SessionNote key={`${t.today}-${t.workout}`} t={t} />
    </Sheet>
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
        {hasClip(s.step.exercise.id)
          ? <span className="row-thumb" aria-hidden="true"><ExerciseStill exercise={s.step.exercise} />{mark && <span className="mark">{mark}</span>}</span>
          : <span className="mark" aria-hidden="true">{mark}</span>}
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

/** Notiz zur Einheit aus dem nativen Feld: speichert 1,5 s nach der letzten Eingabe und beim Schließen */
function useNoteSaver(t: Training) {
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    const v = pending.current; pending.current = null
    if (v !== null && (L.cleanNote(v) ?? '') !== (t.todaySession?.note ?? '')) t.updateToday(s => L.withNote(s, v))
  }
  const change = (v: string) => {
    pending.current = v
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 1500)
  }
  return { change, flush }
}
