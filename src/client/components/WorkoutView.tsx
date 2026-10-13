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
  const adjustNote = adjusted ? `Heute angepasst: ${[today?.added?.length ? `${today.added.length} dazu` : '', today?.removed?.length ? `${today.removed.length} weggelassen` : ''].filter(Boolean).join(', ')}` : undefined
  const saveAs = (name: string) => {
    const nw = L.workoutFromDay(t.ix, t.workout, today, name)
    t.editPlan(p => L.withWorkout(p, nw)); setOver(null); setEditing(false); onSavedWorkout?.(nw.id)
  }
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
      ...(editing ? [] : routineBlocks('warm', 'Warm-up', w.warmup)),
      ...(editing ? [
        { type: 'text', text: 'Nur für heute – dein Plan bleibt, wie er ist. Bereits trainierte Übungen bleiben drin.', style: 'muted' } as NBlock,
        ...adjustList.map((x): NBlock => x.trained
          ? { type: 'row', title: x.step.exercise.name, subtitle: x.added ? 'nur heute' : undefined, trailing: 'trainiert', state: 'done' }
          : { type: 'check', style: 'select', id: `adj:${x.pid}`, title: x.step.exercise.name, subtitle: [x.added ? 'nur heute' : null, x.step.target.label].filter(Boolean).join(' · '), on: x.on }),
        { type: 'button', id: 'add', title: 'Übung hinzufügen', symbol: 'plus' } as NBlock,
        ...(adjusted ? [{ type: 'button', id: 'saveas', title: 'Als neues Workout speichern', symbol: 'square.and.arrow.down' } as NBlock] : []),
      ] : slots.map((s): NBlock => ({
        type: 'row', id: `ex:${s.pid}`, title: s.step.exercise.name,
        eyebrow: s.pid === focus && s.state === 'open' ? 'Als Nächstes' : s.added ? 'Nur heute' : undefined,
        subtitle: [s.state === 'open' && s.last ? `Zuletzt ${s.last.sets.map(x => x.value).join(' · ')}` : null, s.ready ? 'bereit für die nächste Stufe' : null].filter(Boolean).join(' · ') || undefined,
        trailing: s.state === 'done' ? s.sets.map(x => x.value).join(' · ') : s.state === 'skipped' ? 'übersprungen' : s.state === 'paused' ? 'pausiert'
          : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label,
        state: s.pid === focus && s.state === 'open' ? 'next' : s.state,
        clip: hasClip(s.step.exercise.id) ? s.step.exercise.id : undefined,
      }))),
      ...(editing ? [] : [
        { type: 'button', id: 'adjust', title: 'Heute anpassen', symbol: 'slider.horizontal.3' } as NBlock,
        ...(adjustNote ? [{ type: 'text', text: adjustNote, style: 'small' } as NBlock] : []),
        ...routineBlocks('cool', cool, w.cooldown),
        { type: 'field', id: 'note', label: 'Notiz zur Einheit', value: t.todaySession?.note ?? '', placeholder: 'z. B. schlecht geschlafen, Schulter links zwickt' } as NBlock,
      ]),
    ],
    footer: editing ? [{ id: 'done', title: 'Fertig', symbol: 'checkmark', style: 'prominent' }]
      : onStart ? [{ id: 'start', title: `${w.name} starten`, symbol: 'play.fill', style: 'prominent' }] : undefined,
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
      <LadderPicker t={t} exclude={slots.map(s => s.pid)} sub="Nur für heute – dein Plan bleibt, wie er ist" parent={{ id: 'plan', title: w.focus }}
        onPick={pid => { t.updateToday(x => L.withAdded(x, pid)); setOver(null) }} onClose={() => setOver(null)} />
    )}
    {over === 'save' && (
      <NameSheet parent={{ id: 'plan', title: w.focus }} title="Als neues Workout speichern" sub="Mit der heutigen Übungsliste und Satzzahl – Wochentage danach wählen"
        initial={`${w.name} angepasst`} ok="Speichern" onSave={saveAs} onClose={() => setOver(null)} />
    )}
  </>
  if (native) return layers

  return (
    <>
    <Sheet large title={w.focus} onClose={onClose}
      sub={sub}
      footer={editing ? <button className="btn btn-primary btn-block" onClick={() => setEditing(false)}><Icon name="check" size={20} /> Fertig</button>
        : onStart && <button className="btn btn-primary btn-block bar-start" onClick={onStart}><Icon name="play" size={20} /> {w.name} starten</button>}>
      {done > 0 && (
        <div className="progress" role="progressbar" aria-label="Sätze erledigt" aria-valuemin={0} aria-valuemax={planned} aria-valuenow={done}>
          <i style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
        </div>
      )}
      {editing ? <>
        <p className="hint">Nur für heute – dein Plan bleibt, wie er ist. Bereits trainierte Übungen bleiben drin.</p>
        <ul className="pe-days">
          {adjustList.map(x => (
            <li key={x.pid}>
              <button className={`check${x.on ? ' on' : ''}`} aria-pressed={x.on} disabled={x.trained} onClick={() => toggleSlot(x.pid, !x.on)}>
                <span className="box" aria-hidden="true">{x.on && <Icon name="check" size={14} />}</span>
                <span><b>{x.step.exercise.name}</b>{[x.added ? 'nur heute' : null, x.trained ? 'trainiert' : x.step.target.label].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-secondary btn-block" onClick={() => setOver('add')}><Icon name="plus" size={18} /> Übung hinzufügen</button>
        {adjusted && <button className="btn btn-outline btn-block" onClick={() => setOver('save')}>Als neues Workout speichern</button>}
      </> : <>
        <Routine t={t} title="Warm-up" items={w.warmup} openActivity={openActivity} />
        <ol className="slots">
          {slots.map(s => <Row key={s.pid} s={s} next={s.pid === focus} onClick={() => openFocus(s.pid)} />)}
        </ol>
        <button className="btn btn-ghost btn-block" onClick={() => setEditing(true)}><Icon name="adjust" size={18} /> Heute anpassen</button>
        {adjustNote && <p className="hint pe-note">{adjustNote}</p>}
        <Routine t={t} title={w.cooldown.some(i => i.cardio) ? 'Cardio & Cool-down' : 'Cool-down & Dehnen'} items={w.cooldown} openActivity={openActivity} />
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
    : s.state === 'skipped' ? 'übersprungen' : s.state === 'paused' ? 'pausiert'
    : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label
  return (
    <li>
      <button className={`row ${s.state}${next ? ' next' : ''}`} onClick={onClick}>
        {hasClip(s.step.exercise.id)
          ? <span className="row-thumb" aria-hidden="true"><ExerciseStill exercise={s.step.exercise} />{mark && <span className="mark">{mark}</span>}</span>
          : <span className="mark" aria-hidden="true">{mark}</span>}
        <span className="row-main">
          {next ? <small className="next-label">Als Nächstes</small> : s.added && <small className="next-label">Nur heute</small>}
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
