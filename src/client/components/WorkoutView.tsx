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
import { LadderPicker, NameSheet } from './PlanEditor'
import { t as tr, tn } from '../i18n'

interface Props {
  t: Training
  slots: L.SlotView[]
  focus: string | undefined
  openFocus: (pid: string) => void
  openActivity: () => void
  onClose: () => void
  /** ohne laufende Session: Start-Button in der Fußzeile */
  onStart?: () => void
  /** nach „Als neues Workout speichern“: das neue Workout zum Weiterbearbeiten öffnen */
  onSavedWorkout?: (id: string) => void
}

/** Übungsplan des Tages als großes Sheet – vor dem Start als Vorschau, im Training als Liste zum Springen */
export function PlanSheet({ t, slots, focus, openFocus, openActivity, onClose, onStart, onSavedWorkout }: Props) {
  const w = t.ix.workouts.get(t.workout)!
  // Tagesanpassung: Übungen nur für heute weglassen/hinzufügen, danach optional als Workout speichern
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState<'add' | 'save' | null>(null)
  const today = t.todaySession
  const adjusted = L.isAdjusted(today)
  const adjustList = editing ? [
    ...w.slots.filter(sl => t.ix.progressions.has(sl.progression)).map(sl => ({ pid: sl.progression, added: false, on: !today?.removed?.includes(sl.progression) })),
    ...(today?.added ?? []).filter(pid => t.ix.progressions.has(pid) && !w.slots.some(sl => sl.progression === pid)).map(pid => ({ pid, added: true, on: true })),
  ].map(x => {
    const step = L.currentStep(t.ix, t.state, x.pid)
    return { ...x, step, trained: L.setsOf(today, step.exercise.id).length > 0 }
  }) : []
  const toggleSlot = (pid: string, on: boolean) => t.updateToday(x => L.withRemoved(x, pid, !on))
  const adjustNote = adjusted ? tr('training.plan.adjusted', { list: [today?.added?.length ? tr('training.plan.addedN', { n: today.added.length }) : '', today?.removed?.length ? tr('training.plan.removedN', { n: today.removed.length }) : ''].filter(Boolean).join(', ') }) : undefined
  const saveAs = (name: string) => {
    const nw = L.workoutFromDay(t.ix, t.workout, today, name)
    t.editPlan(p => L.withWorkout(p, nw)); setOver(null); setEditing(false); onSavedWorkout?.(nw.id)
  }
  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length
  const sub = `${w.name} · ${tn('training.plan.exercises', counted.length)} · ${tn('training.plan.sets', planned)}${skipped ? ` · ${tr('training.plan.skippedN', { n: skipped })}` : ''}${paused ? ` · ${tr('training.plan.pausedN', { n: paused })}` : ''}`

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
  const cool = w.cooldown.some(i => i.cardio) ? tr('training.plan.cardioCooldown') : tr('training.plan.cooldown')
  useNativeSheet(native ? {
    id: 'plan', title: w.focus, subtitle: sub, detents: ['medium', 'large'],
    blocks: [
      ...(done > 0 ? [{ type: 'segments', done, total: planned } as NBlock] : []),
      ...(editing ? [] : routineBlocks('warm', tr('training.plan.warmup'), w.warmup)),
      ...(editing ? [
        { type: 'text', text: tr('training.plan.adjustHint'), style: 'muted' } as NBlock,
        ...adjustList.map((x): NBlock => x.trained
          ? { type: 'row', title: x.step.exercise.name, subtitle: x.added ? tr('training.plan.onlyToday') : undefined, trailing: tr('training.plan.trained'), state: 'done' }
          : { type: 'check', style: 'select', id: `adj:${x.pid}`, title: x.step.exercise.name, subtitle: [x.added ? tr('training.plan.onlyToday') : null, x.step.target.label].filter(Boolean).join(' · '), on: x.on }),
        { type: 'button', id: 'add', title: tr('training.plan.addExercise'), symbol: 'plus' } as NBlock,
        ...(adjusted ? [{ type: 'button', id: 'saveas', title: tr('training.plan.saveAs'), symbol: 'square.and.arrow.down' } as NBlock] : []),
      ] : slots.map((s): NBlock => ({
        type: 'row', id: `ex:${s.pid}`, title: s.step.exercise.name,
        eyebrow: s.pid === focus && s.state === 'open' ? tr('training.plan.next') : s.substituteFor ? tr('training.plan.substitute', { name: s.substituteFor }) : s.added ? tr('training.plan.onlyTodayLabel') : undefined,
        subtitle: [s.state === 'open' && s.last ? tr('training.plan.last', { sets: s.last.sets.map(x => x.value).join(' · ') }) : null, s.ready ? tr('training.plan.ready') : null].filter(Boolean).join(' · ') || undefined,
        trailing: s.state === 'done' ? s.sets.map(x => x.value).join(' · ') : s.state === 'skipped' ? tr('training.plan.skipped') : s.state === 'paused' ? (s.blockedBy ?? tr('training.plan.paused'))
          : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label,
        state: s.pid === focus && s.state === 'open' ? 'next' : s.state,
        clip: hasClip(s.step.exercise.id) ? s.step.exercise.id : undefined,
      }))),
      ...(editing ? [] : [
        { type: 'button', id: 'adjust', title: tr('training.plan.adjust'), symbol: 'slider.horizontal.3' } as NBlock,
        ...(adjustNote ? [{ type: 'text', text: adjustNote, style: 'small' } as NBlock] : []),
        ...routineBlocks('cool', cool, w.cooldown),
        { type: 'field', id: 'note', label: tr('training.noteSession'), value: t.todaySession?.note ?? '', placeholder: tr('training.plan.notePlaceholder') } as NBlock,
      ]),
    ],
    footer: editing ? [{ id: 'done', title: tr('training.done'), symbol: 'checkmark', style: 'prominent' }]
      : onStart ? [{ id: 'start', title: tr('training.bar.start', { name: w.name }), symbol: 'play.fill', style: 'prominent' }] : undefined,
  } : null, e => {
    if (e.type === 'dismiss') { note.flush(); onClose() }
    else if (e.type === 'text' && e.id === 'note') note.change(String(e.value ?? ''))
    else if (e.type === 'toggle' && e.id?.startsWith('open:')) { const k = e.id.slice(5); setOpenR(o => ({ ...o, [k]: !o[k] })) }
    else if (e.type === 'toggle' && e.id?.startsWith('rt:')) t.updateToday(x => L.withRoutine(x, e.id!.slice(3), !!e.value))
    else if (e.type === 'toggle' && e.id?.startsWith('cardio:')) openActivity()
    else if (e.type === 'tap' && e.id?.startsWith('ex:')) { note.flush(); openFocus(e.id.slice(3)) }
    else if (e.type === 'tap' && e.id === 'start') { note.flush(); onStart?.() }
    else if (e.type === 'tap' && e.id === 'adjust') { note.flush(); setEditing(true) }
    else if (e.type === 'tap' && e.id === 'done') setEditing(false)
    else if (e.type === 'tap' && e.id === 'add') setOver('add')
    else if (e.type === 'tap' && e.id === 'saveas') setOver('save')
    else if (e.type === 'toggle' && e.id?.startsWith('adj:')) toggleSlot(e.id.slice(4), !!e.value)
  })
  const layers = <>
    {over === 'add' && (
      <LadderPicker t={t} exclude={slots.map(s => s.pid)} sub={tr('training.plan.addHint')} parent={{ id: 'plan', title: w.focus }}
        onPick={pid => { t.updateToday(x => L.withAdded(x, pid)); setOver(null) }} onClose={() => setOver(null)} />
    )}
    {over === 'save' && (
      <NameSheet parent={{ id: 'plan', title: w.focus }} title={tr('training.plan.saveAs')} sub={tr('training.plan.saveAsSub')}
        initial={tr('training.plan.adjustedName', { name: w.name })} ok={tr('training.plan.save')} onSave={saveAs} onClose={() => setOver(null)} />
    )}
  </>
  if (native) return layers

  return (
    <>
    <Sheet large title={w.focus} onClose={onClose}
      sub={sub}
      footer={editing ? <button className="btn btn-primary btn-block" onClick={() => setEditing(false)}><Icon name="check" size={20} /> {tr('training.done')}</button>
        : onStart && <button className="btn btn-primary btn-block bar-start" onClick={onStart}><Icon name="play" size={20} /> {tr('training.bar.start', { name: w.name })}</button>}>
      {done > 0 && (
        <div className="progress" role="progressbar" aria-label={tr('training.plan.progress')} aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
          <i style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
        </div>
      )}
      {editing ? <>
        <p className="hint">{tr('training.plan.adjustHint')}</p>
        <ul className="pe-days">
          {adjustList.map(x => (
            <li key={x.pid}>
              <button className={`check${x.on ? ' on' : ''}`} aria-pressed={x.on} disabled={x.trained} onClick={() => toggleSlot(x.pid, !x.on)}>
                <span className="box" aria-hidden="true">{x.on && <Icon name="check" size={14} />}</span>
                <span><b>{x.step.exercise.name}</b>{[x.added ? tr('training.plan.onlyToday') : null, x.trained ? tr('training.plan.trained') : x.step.target.label].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-secondary btn-block" onClick={() => setOver('add')}><Icon name="plus" size={18} /> {tr('training.plan.addExercise')}</button>
        {adjusted && <button className="btn btn-outline btn-block" onClick={() => setOver('save')}>{tr('training.plan.saveAs')}</button>}
      </> : <>
        <Routine t={t} title={tr('training.plan.warmup')} items={w.warmup} openActivity={openActivity} />
        <ol className="slots">
          {slots.map(s => <Row key={s.pid} s={s} next={s.pid === focus} onClick={() => openFocus(s.pid)} />)}
        </ol>
        <button className="btn btn-ghost btn-block" onClick={() => setEditing(true)}><Icon name="adjust" size={18} /> {tr('training.plan.adjust')}</button>
        {adjustNote && <p className="hint pe-note">{adjustNote}</p>}
        <Routine t={t} title={cool} items={w.cooldown} openActivity={openActivity} />
        <SessionNote key={`${t.today}-${t.workout}`} t={t} />
      </>}
    </Sheet>
    {layers}
    </>
  )
}

function Row({ s, next, onClick }: { s: L.SlotView; next: boolean; onClick: () => void }) {
  const mark = { open: null, done: <Icon name="check" size={14} />, skipped: <Icon name="minus" size={14} />, paused: <Icon name="pause" size={14} /> }[s.state]
  const right = s.state === 'done' ? s.sets.map(x => x.value).join(' · ')
    : s.state === 'skipped' ? tr('training.plan.skipped') : s.state === 'paused' ? (s.blockedBy ?? tr('training.plan.paused'))
    : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label
  return (
    <li>
      <button className={`row ${s.state}${next ? ' next' : ''}`} onClick={onClick}>
        {hasClip(s.step.exercise.id)
          ? <span className="row-thumb" aria-hidden="true"><ExerciseStill exercise={s.step.exercise} />{mark && <span className="mark">{mark}</span>}</span>
          : <span className="mark" aria-hidden="true">{mark}</span>}
        <span className="row-main">
          {next ? <small className="next-label">{tr('training.plan.next')}</small> : s.substituteFor ? <small className="next-label">{tr('training.plan.substitute', { name: s.substituteFor })}</small> : s.added && <small className="next-label">{tr('training.plan.onlyTodayLabel')}</small>}
          <b>{s.step.exercise.name}</b>
          {s.state === 'open' && s.last && <small>{tr('training.plan.last', { sets: s.last.sets.map(x => x.value).join(' · ') })}</small>}
          {s.ready && <small className="ready">{tr('training.plan.ready')}</small>}
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
    <button className="btn btn-ghost btn-block note-add" onClick={() => setOpen(true)}><Icon name="note" /> {tr('training.noteSession')}</button>
  )
  return (
    <div className="card note-card">
      <label className="field">
        <span className="field-label"><Icon name="note" size={16} /> {tr('training.noteSession')}</span>
        <textarea rows={3} maxLength={L.NOTE_MAX} value={text} placeholder={tr('training.plan.notePlaceholder')}
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
