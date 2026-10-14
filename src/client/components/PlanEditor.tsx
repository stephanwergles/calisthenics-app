'use client'
/* Eigener Plan: Workouts anlegen/ändern, Wochentage belegen, Leitern hinzufügen.
   Jede Änderung geht sofort in den Plan (t.editPlan) – ohne eigenen Plan entsteht er bei der
   ersten Änderung aus dem Katalog-Plan. Alles als Sheets, in der iOS-App nativ. */
import { useRef, useState } from 'react'
import type { ProgressionId, Weekday, Workout, WorkoutId } from '@/domain/model'
import * as L from '@/core/logic'
import type { Training } from '@/core/useTraining'
import { ask, type NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { hasClip, ExerciseStill } from './ExerciseMedia'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { t as tr, tn } from '@/core/i18n'

/** Alias auf L.WEEKDAY_LONG (übersetzt) – andere Dateien importieren DAY_NAME */
export const DAY_NAME: Record<Weekday, string> = L.WEEKDAY_LONG
const count = (n: number) => tn('editor.exercises', n)
const daysOf = (t: Training, id: WorkoutId) => L.plannedDays(t.ix, id).map(d => L.WEEKDAY_SHORT[d]).join(' · ')

/* ── Leiter auswählen ─────────────────────────────────────────────────────── */

type Parent = { id: string; title: string }

export function LadderPicker({ t, exclude, sub, onPick, onClose, parent }: {
  t: Training; exclude: ProgressionId[]; sub?: string; onPick: (pid: ProgressionId) => void; onClose: () => void; parent?: Parent
}) {
  const native = useNativeShell()
  const groups = L.ladderChoices(t.ix, t.state, exclude)
  const subtitle = sub ?? tr('editor.ladderSub')
  useNativeSheet(native ? {
    id: 'ladders', parent: parent?.id, title: tr('editor.addExercise'), subtitle, detents: ['large'],
    blocks: groups.flatMap(g => [
      { type: 'section', title: g.label } as NBlock,
      ...g.items.map((x): NBlock => ({ type: 'row', id: `add:${x.pid}`, title: x.name, subtitle: x.sub, clip: hasClip(x.exercise.id) ? x.exercise.id : undefined })),
    ]),
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('add:')) onPick(e.id.slice(4))
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={tr('editor.addExercise')} sub={subtitle} back={parent?.title} onClose={onClose}>
      {groups.map(g => (
        <section key={g.id} className="pe-group">
          <h4 className="pe-section">{g.label}</h4>
          <ol className="slots">
            {g.items.map(x => (
              <li key={x.pid}>
                <button className="row" onClick={() => onPick(x.pid)}>
                  {hasClip(x.exercise.id)
                    ? <span className="row-thumb" aria-hidden="true"><ExerciseStill exercise={x.exercise} /></span>
                    : <span className="mark" aria-hidden="true"><Icon name="plus" size={14} /></span>}
                  <span className="row-main"><b>{x.name}</b><small>{x.sub}</small></span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Sheet>
  )
}

/* ── Name eingeben ────────────────────────────────────────────────────────── */

export function NameSheet({ title, sub, initial = '', ok, onSave, onClose, parent }: {
  title: string; sub?: string; initial?: string; ok: string; onSave: (name: string) => void; onClose: () => void; parent?: Parent
}) {
  const native = useNativeShell()
  const [name, setName] = useState(initial)
  const text = useRef(initial)
  const save = (v: string) => { const n = v.replace(/\s+/g, ' ').trim(); if (n) onSave(n.slice(0, 80)) }
  useNativeSheet(native ? {
    id: 'name', parent: parent?.id, title, subtitle: sub, detents: ['medium'],
    blocks: [{ type: 'field', id: 'name', label: tr('editor.name'), value: initial, placeholder: tr('editor.namePlaceholder') }],
    footer: [{ id: 'save', title: ok, symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'text' && e.id === 'name') text.current = String(e.value ?? '')
    else if (e.type === 'tap' && e.id === 'save') save(text.current)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title={title} sub={sub} back={parent?.title} onClose={onClose}>
      <form className="pe-name" onSubmit={e => { e.preventDefault(); save(name) }}>
        <label className="field">{tr('editor.name')}
          <input autoFocus maxLength={80} value={name} placeholder={tr('editor.namePlaceholder')} onChange={e => setName(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-block" disabled={!name.trim()}><Icon name="check" size={18} /> {ok}</button>
      </form>
    </Sheet>
  )
}

/* ── Meine Workouts (Übersicht) mit Editor, Slot-Sheet und Auswahl darüber ── */

type Layer = { kind: 'edit'; id: WorkoutId } | null
type Over = { kind: 'slot'; pid: ProgressionId } | { kind: 'add' } | { kind: 'rename' } | { kind: 'new' } | null

/** Workouts bearbeiten: (optional) Übersicht, darüber Editor, darüber Slot/Auswahl/Name.
    Ohne `list` (Plan-Tab) schließt das Ganze, sobald der Editor bzw. das Namens-Sheet zugeht. */
export function WorkoutsHost({ t, initial, startNew, list = true, onClose }: {
  t: Training; initial?: WorkoutId; startNew?: boolean; list?: boolean; onClose: () => void
}) {
  const [layer, setLayer] = useState<Layer>(initial ? { kind: 'edit', id: initial } : null)
  const [over, setOver] = useState<Over>(startNew ? { kind: 'new' } : null)
  const closeEditor = () => { setLayer(null); setOver(null); if (!list) onClose() }
  const edited = layer?.kind === 'edit' ? t.ix.workouts.get(layer.id) : undefined
  const change = (w: Workout) => t.editPlan(p => L.withWorkout(p, w))

  return (
    <>
      {list && <WorkoutsSheet t={t} onClose={onClose} onEdit={id => setLayer({ kind: 'edit', id })} onNew={() => setOver({ kind: 'new' })} />}
      {edited && !edited.archived && (
        <WorkoutEditor t={t} w={edited} onClose={closeEditor}
          onSlot={pid => setOver({ kind: 'slot', pid })} onAdd={() => setOver({ kind: 'add' })} onRename={() => setOver({ kind: 'rename' })}
          onDelete={async () => {
            if (L.workoutsInWeekOrder(t.ix).length <= 1) { await ask({ title: tr('editor.lastTitle'), message: tr('editor.lastMessage'), ok: tr('editor.ok') }); return }
            if (!await ask({ title: tr('editor.deleteTitle', { name: edited.name }), message: tr('editor.deleteMessage'), ok: tr('editor.delete'), destructive: true })) return
            t.editPlan(p => L.withoutWorkout(p, edited.id)); closeEditor()
          }} />
      )}
      {edited && over?.kind === 'slot' && edited.slots.some(s => s.progression === over.pid) && (
        <SlotSheet t={t} w={edited} pid={over.pid} onChange={change} onClose={() => setOver(null)} parent={{ id: 'workout-edit', title: edited.name }} />
      )}
      {edited && over?.kind === 'add' && (
        <LadderPicker t={t} exclude={edited.slots.map(s => s.progression)} sub={tr('editor.addTo', { name: edited.name })} parent={{ id: 'workout-edit', title: edited.name }}
          onPick={pid => { change(L.withSlot(t.ix, edited, pid)); setOver(null) }} onClose={() => setOver(null)} />
      )}
      {edited && over?.kind === 'rename' && (
        <NameSheet title={tr('editor.rename')} initial={edited.name} ok={tr('editor.save')} onClose={() => setOver(null)} parent={{ id: 'workout-edit', title: edited.name }}
          onSave={name => { change({ ...edited, name }); setOver(null) }} />
      )}
      {over?.kind === 'new' && (
        <NameSheet title={tr('editor.newWorkout')} sub={tr('editor.newSub')} ok={tr('editor.create')} onClose={() => { setOver(null); if (!list && !layer) onClose() }}
          onSave={name => {
            const w = L.newWorkout(t.ix, name, [])
            t.editPlan(p => L.withWorkout(p, w)); setOver(null); setLayer({ kind: 'edit', id: w.id })
          }} />
      )}
    </>
  )
}

function WorkoutsSheet({ t, onEdit, onNew, onClose }: { t: Training; onEdit: (id: WorkoutId) => void; onNew: () => void; onClose: () => void }) {
  const native = useNativeShell()
  const list = L.workoutsInWeekOrder(t.ix)
  const sub = t.plan ? tr('editor.subOwn') : tr('editor.subDefault')
  const week = L.WEEK_ORDER.map(d => ({ d, w: t.ix.catalog.weekplan[d] ? t.ix.workouts.get(t.ix.catalog.weekplan[d]!) : undefined }))
  useNativeSheet(native ? {
    id: 'workouts', title: tr('editor.myWorkouts'), subtitle: sub, detents: ['large'],
    blocks: [
      ...list.map((w): NBlock => ({ type: 'row', id: `w:${w.id}`, title: w.name, subtitle: `${w.focus} · ${count(w.slots.length)}`, trailing: daysOf(t, w.id) || tr('editor.noDay'), symbol: 'none' })),
      { type: 'button', id: 'new', title: tr('editor.newWorkout'), symbol: 'plus' },
      { type: 'section', title: tr('editor.week') },
      ...week.map(({ d, w }): NBlock => ({ type: 'row', id: w ? `w:${w.id}` : undefined, title: DAY_NAME[d], trailing: w?.name ?? tr('editor.restDay'), symbol: 'none' })),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('w:')) onEdit(e.id.slice(2))
    else if (e.type === 'tap' && e.id === 'new') onNew()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={tr('editor.myWorkouts')} sub={sub} onClose={onClose}>
      <ol className="slots">
        {list.map(w => (
          <li key={w.id}>
            <button className="row" onClick={() => onEdit(w.id)}>
              <span className="row-main"><b>{w.name}</b><small>{w.focus} · {count(w.slots.length)}</small></span>
              <span className="row-side">{daysOf(t, w.id) || tr('editor.noDay')}</span>
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-secondary btn-block" onClick={onNew}><Icon name="plus" size={18} /> {tr('editor.newWorkout')}</button>
      <h4 className="pe-section">{tr('editor.week')}</h4>
      <ul className="pe-week">
        {week.map(({ d, w }) => <li key={d}><span>{DAY_NAME[d]}</span><b className={w ? '' : 'pe-off'}>{w?.name ?? tr('editor.restDay')}</b></li>)}
      </ul>
    </Sheet>
  )
}

function WorkoutEditor({ t, w, onSlot, onAdd, onRename, onDelete, onClose }: {
  t: Training; w: Workout; onSlot: (pid: ProgressionId) => void; onAdd: () => void; onRename: () => void; onDelete: () => void; onClose: () => void
}) {
  const native = useNativeShell()
  const weekplan = t.ix.catalog.weekplan
  const other = (d: Weekday) => (weekplan[d] && weekplan[d] !== w.id ? t.ix.workouts.get(weekplan[d]!)?.name : undefined)
  const setDay = (d: Weekday, on: boolean) => t.editPlan(p => L.withDay(p, d, on ? w.id : undefined))
  const slots = w.slots.flatMap(sl => {
    if (!t.ix.progressions.has(sl.progression)) return []
    const step = L.currentStep(t.ix, t.state, sl.progression)
    return [{ sl, step, sets: sl.sets ?? step.target.sets }]
  })
  const sub = `${w.focus} · ${count(slots.length)}`
  useNativeSheet(native ? {
    id: 'workout-edit', title: w.name, subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'section', title: tr('editor.exercisesHead') },
      ...(slots.length ? [] : [{ type: 'text', text: tr('editor.empty'), style: 'muted' } as NBlock]),
      ...slots.map(({ sl, step, sets }): NBlock => ({
        type: 'row', id: `slot:${sl.progression}`, title: step.exercise.name,
        subtitle: `${tr('editor.stage', { stage: step.index + 1, total: step.total })} · ${step.target.label.replace(/^\d+\s*×/, `${sets} ×`)}`,
        clip: hasClip(step.exercise.id) ? step.exercise.id : undefined,
      })),
      { type: 'button', id: 'add', title: tr('editor.addExercise'), symbol: 'plus' },
      { type: 'section', title: tr('editor.weekdays') },
      ...L.WEEK_ORDER.map((d): NBlock => ({ type: 'check', style: 'select', id: `day:${d}`, title: DAY_NAME[d], subtitle: other(d) ? tr('editor.instead', { name: other(d)! }) : undefined, on: weekplan[d] === w.id })),
      { type: 'buttons', buttons: [{ id: 'rename', title: tr('editor.rename'), symbol: 'pencil' }, { id: 'delete', title: tr('editor.delete'), symbol: 'trash', style: 'destructive' }] },
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('slot:')) onSlot(e.id.slice(5))
    else if (e.type === 'tap' && e.id === 'add') onAdd()
    else if (e.type === 'tap' && e.id === 'rename') onRename()
    else if (e.type === 'tap' && e.id === 'delete') void onDelete()
    else if (e.type === 'toggle' && e.id?.startsWith('day:')) setDay(e.id.slice(4) as Weekday, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={w.name} sub={sub} onClose={onClose}>
      <h4 className="pe-section">{tr('editor.exercisesHead')}</h4>
      {!slots.length && <p className="hint">{tr('editor.empty')}</p>}
      <ol className="slots">
        {slots.map(({ sl, step, sets }) => (
          <li key={sl.progression}>
            <button className="row" onClick={() => onSlot(sl.progression)}>
              {hasClip(step.exercise.id)
                ? <span className="row-thumb" aria-hidden="true"><ExerciseStill exercise={step.exercise} /></span>
                : <span className="mark" aria-hidden="true" />}
              <span className="row-main"><b>{step.exercise.name}</b><small>{tr('editor.stage', { stage: step.index + 1, total: step.total })}</small></span>
              <span className="row-side">{step.target.label.replace(/^\d+\s*×/, `${sets} ×`)}</span>
            </button>
          </li>
        ))}
      </ol>
      <button className="btn btn-secondary btn-block" onClick={onAdd}><Icon name="plus" size={18} /> {tr('editor.addExercise')}</button>
      <h4 className="pe-section">{tr('editor.weekdays')}</h4>
      <ul className="pe-days">
        {L.WEEK_ORDER.map(d => {
          const on = weekplan[d] === w.id
          return (
            <li key={d}>
              <button className={`check${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setDay(d, !on)}>
                <span className="box" aria-hidden="true">{on && <Icon name="check" size={14} />}</span>
                <span><b>{DAY_NAME[d]}</b>{other(d) && <>{tr('editor.instead', { name: other(d)! })}</>}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="row-btns">
        <button className="btn btn-secondary grow" onClick={onRename}><Icon name="edit" size={18} /> {tr('editor.rename')}</button>
        <button className="btn btn-danger" onClick={() => void onDelete()}><Icon name="trash" size={18} /> {tr('editor.delete')}</button>
      </div>
    </Sheet>
  )
}

function SlotSheet({ t, w, pid, onChange, onClose, parent }: { t: Training; w: Workout; pid: ProgressionId; onChange: (w: Workout) => void; onClose: () => void; parent?: Parent }) {
  const native = useNativeShell()
  const i = w.slots.findIndex(s => s.progression === pid)
  const step = L.currentStep(t.ix, t.state, pid)
  const sets = w.slots[i].sets ?? step.target.sets
  const setSets = (n: number) => onChange(L.withSlotSets(t.ix, w, pid, n))
  const move = (by: -1 | 1) => onChange(L.movedSlot(t.ix, w, pid, by))
  const remove = () => { onChange(L.withoutSlot(t.ix, w, pid)); onClose() }
  const sub = tr('editor.slotSub', { stage: step.index + 1, total: step.total, target: step.target.label })
  useNativeSheet(native ? {
    id: 'slot-edit', parent: parent?.id, title: step.exercise.name, subtitle: sub, detents: ['medium'],
    blocks: [
      { type: 'stepper', id: 'sets', label: tr('editor.sets'), value: String(sets) },
      { type: 'buttons', buttons: [
        ...(i > 0 ? [{ id: 'up', title: tr('editor.earlier'), symbol: 'arrow.up' }] : []),
        ...(i < w.slots.length - 1 ? [{ id: 'down', title: tr('editor.later'), symbol: 'arrow.down' }] : []),
      ] },
      { type: 'button', id: 'remove', title: tr('editor.remove'), symbol: 'minus.circle', style: 'destructive' },
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'sets:minus') setSets(sets - 1)
    else if (e.type === 'tap' && e.id === 'sets:plus') setSets(sets + 1)
    else if (e.type === 'tap' && e.id === 'up') move(-1)
    else if (e.type === 'tap' && e.id === 'down') move(1)
    else if (e.type === 'tap' && e.id === 'remove') remove()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title={step.exercise.name} sub={sub} back={parent?.title} onClose={onClose}>
      <div className="stepper">
        <span className="stepper-label">{tr('editor.sets')}</span>
        <div className="stepper-row">
          <button className="btn btn-secondary btn-icon" aria-label={tr('editor.setsLess')} disabled={sets <= 1} onClick={() => setSets(sets - 1)}><Icon name="minus" size={20} /></button>
          <output className="stepper-val">{sets}</output>
          <button className="btn btn-secondary btn-icon" aria-label={tr('editor.setsMore')} disabled={sets >= 10} onClick={() => setSets(sets + 1)}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <div className="row-btns">
        <button className="btn btn-secondary grow" disabled={i <= 0} onClick={() => move(-1)}><Icon name="up" size={18} /> {tr('editor.earlier')}</button>
        <button className="btn btn-secondary grow" disabled={i >= w.slots.length - 1} onClick={() => move(1)}><Icon name="lower" size={18} /> {tr('editor.later')}</button>
      </div>
      <button className="btn btn-ghost btn-block" onClick={remove}><Icon name="minus" size={18} /> {tr('editor.remove')}</button>
    </Sheet>
  )
}

/* ── Wochentag belegen (Plan-Tab: Tipp auf einen Tag) ─────────────────────── */

export function DayAssign({ t, day, onClose }: { t: Training; day: Weekday; onClose: () => void }) {
  const native = useNativeShell()
  const current = t.ix.catalog.weekplan[day]
  const list = L.workoutsInWeekOrder(t.ix)
  const pick = (id: WorkoutId | undefined) => { if (id !== current) t.editPlan(p => L.withDay(p, day, id)); onClose() }
  useNativeSheet(native ? {
    id: 'day-assign', title: DAY_NAME[day], subtitle: tr('editor.dayQuestion'), detents: ['medium', 'large'],
    blocks: [
      ...list.map((w): NBlock => ({ type: 'check', style: 'select', id: `w:${w.id}`, title: w.name, subtitle: `${w.focus} · ${count(w.slots.length)}`, on: current === w.id })),
      { type: 'check', style: 'select', id: 'rest', title: tr('editor.restDay'), on: !current },
    ],
  } : null, e => {
    if (e.type === 'toggle' && e.id?.startsWith('w:')) pick(e.id.slice(2))
    else if (e.type === 'toggle' && e.id === 'rest') pick(undefined)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title={DAY_NAME[day]} sub={tr('editor.dayQuestion')} onClose={onClose}>
      <ul className="pe-days">
        {[...list.map(w => ({ id: w.id as string | undefined, name: w.name, sub: `${w.focus} · ${count(w.slots.length)}` })), { id: undefined, name: tr('editor.restDay'), sub: '' }].map(x => {
          const on = x.id === current
          return (
            <li key={x.id ?? 'rest'}>
              <button className={`check${on ? ' on' : ''}`} aria-pressed={on} onClick={() => pick(x.id)}>
                <span className="box" aria-hidden="true">{on && <Icon name="check" size={14} />}</span>
                <span><b>{x.name}</b>{x.sub}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
