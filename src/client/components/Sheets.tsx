'use client'
import { useEffect, useState, type ReactNode } from 'react'
import type { Activity } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'
import { Icon } from './Icon'
import type { SheetSpec } from '../native'
import { useDrag } from '../useSheet'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import type { NBlock } from '../native'
import { t as tr } from '../i18n'

/** Bottom-Sheet: Griff und Kopf lassen sich nach unten wegziehen. `large` = fast volle Höhe mit
    scrollendem Inhalt und fester Fußzeile (z. B. Start-Button). */
export function Sheet({ title, sub, onClose, children, large, footer, back }: {
  title: string; sub?: string; onClose: () => void; children: ReactNode; large?: boolean; footer?: ReactNode
  /** Push-Seite: Zurück-Pfeil mit dem Titel der Seite davor statt Schließen */
  back?: string
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const drag = useDrag({ onDown: onClose })
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet${large ? ' sheet-large' : ''}`} style={drag.style} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-drag" {...drag.bind}>
          <span className="grabber" aria-hidden="true" />
          {back && <button className="btn btn-ghost btn-sm sheet-back" onClick={onClose}><Icon name="left" size={18} /> {back}</button>}
          <div className="sheet-head">
            <div>
              <h3>{title}</h3>
              {sub && <p className="sheet-sub">{sub}</p>}
            </div>
            {!back && <button className="btn btn-secondary btn-icon sheet-close" aria-label={tr('sheets.close')} onClick={onClose}><Icon name="close" size={20} /></button>}
          </div>
        </div>
        {large ? <div className="sheet-body">{children}</div> : children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  )
}

function Stepper({ label, value, step, min, unit, onChange }: { label: string; value: number; step: number; min: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button className="btn btn-secondary btn-icon" aria-label={tr('sheets.decrease', { label })} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}><Icon name="minus" size={20} /></button>
        <output className="stepper-val">{value}{unit && <small>{unit}</small>}</output>
        <button className="btn btn-secondary btn-icon" aria-label={tr('sheets.increase', { label })} onClick={() => onChange(+(value + step).toFixed(1))}><Icon name="plus" size={20} /></button>
      </div>
    </div>
  )
}

/** Satz erfassen: Wert, ggf. Zusatzgewicht, bei Halteübungen ein Hold-Timer */
export function SetSheet({ t, slot, setNo, rest, onClose, onSaved }: {
  t: Training; slot: L.SlotView; setNo: number; rest: RestTimer; onClose: () => void; onSaved: () => void
}) {
  const ex = slot.step.exercise, target = slot.step.target
  const existing = slot.sets.find(x => x.set === setNo)
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const [note, setNote] = useState(existing?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(!!existing?.note)
  const seconds = ex.unit === 'seconds'

  const save = () => {
    const n = L.cleanNote(note)
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}), ...(n ? { note: n } : {}) }))
    t.startSession()
    rest.start(target.restSec)
    onSaved()
  }
  const sub = tr('sheets.set.sub', { set: setNo, planned: slot.planned, target: target.label })
  const native = useNativeShell()
  const fmtKg = (w: number) => `${L.fmtNum(w)} kg`
  useNativeSheet(native ? {
    id: 'set', title: ex.name, subtitle: sub, detents: ['auto', 'large'],
    blocks: [
      { type: 'stepper', id: 'value', label: seconds ? tr('sheets.set.seconds') : tr('sheets.set.reps'), value: `${value}${seconds ? ' s' : ''}` },
      ...(ex.weighted ? [{ type: 'stepper', id: 'weight', label: tr('sheets.set.weight'), value: fmtKg(weight) } as NBlock] : []),
      { type: 'field', id: 'note', label: tr('sheets.set.note'), value: existing?.note ?? '', placeholder: tr('sheets.set.notePlaceholder') },
    ],
    footer: [
      ...(existing ? [{ id: 'delete', title: tr('sheets.set.delete'), symbol: 'trash', style: 'destructive' as const }] : []),
      { id: 'save', title: tr('sheets.save'), symbol: 'checkmark', style: 'prominent' },
    ],
  } : null, e => {
    if (e.type === 'dismiss') onClose()
    else if (e.type === 'text') setNote(String(e.value ?? ''))
    else if (e.id === 'value:minus') setValue(v => Math.max(1, v - (seconds ? 5 : 1)))
    else if (e.id === 'value:plus') setValue(v => v + (seconds ? 5 : 1))
    else if (e.id === 'weight:minus') setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))
    else if (e.id === 'weight:plus') setWeight(w => +(w + 2.5).toFixed(1))
    else if (e.id === 'delete') { t.updateToday(s => L.withoutSet(s, ex.id, setNo)); onClose() }
    else if (e.id === 'save') save()
  })
  if (native) return null
  return (
    <Sheet title={ex.name} sub={sub} onClose={onClose}>
      <div className="steppers">
        <Stepper label={seconds ? tr('sheets.set.seconds') : tr('sheets.set.reps')} value={value} step={seconds ? 5 : 1} min={1} onChange={setValue} />
        {ex.weighted && <Stepper label={tr('sheets.set.weight')} value={weight} step={2.5} min={0} unit="kg" onChange={setWeight} />}
      </div>
      {seconds && (
        <button className="btn btn-outline btn-block hold" onClick={() => rest.start(value)}>
          <Icon name="timer" /> {rest.running ? `${rest.remaining} s` : tr('sheets.set.startTimer', { n: value })}
        </button>
      )}
      {noteOpen ? (
        <label className="field">
          <span className="field-label">{tr('sheets.set.note')}</span>
          <textarea rows={2} maxLength={L.NOTE_MAX} value={note} placeholder={tr('sheets.set.notePlaceholder')}
            autoFocus={!existing?.note} onChange={e => setNote(e.target.value)} />
        </label>
      ) : (
        <button className="btn btn-ghost btn-block note-add" onClick={() => setNoteOpen(true)}><Icon name="note" /> {tr('sheets.set.addNote')}</button>
      )}
      <div className="sheet-actions">
        {existing && <button className="btn btn-danger" onClick={() => { t.updateToday(s => L.withoutSet(s, ex.id, setNo)); onClose() }}>{tr('sheets.set.delete')}</button>}
        <button className="btn btn-secondary" onClick={onClose}>{tr('sheets.cancel')}</button>
        <button className="btn btn-primary grow" onClick={save}>{tr('sheets.save')}</button>
      </div>
    </Sheet>
  )
}

/** Cardio erfassen – Lauf oder Rad, Dauer, optional Distanz und Höhenmeter */
export function ActivitySheet({ t, date, onClose }: { t: Training; date: string; onClose: () => void }) {
  const [kind, setKind] = useState<'run' | 'ride'>('run')
  const [min, setMin] = useState(20)
  const [km, setKm] = useState(0)
  const [hm, setHm] = useState(0)
  const save = () => {
    // Zeitstempel statt laufender Nummer: nach dem Löschen eines Eintrags würde eine Nummer kollidieren
    const a: Activity = { id: `${date}-${kind}-${Date.now().toString(36)}`, date, kind, durationMin: min, ...(km ? { distanceKm: km } : {}), ...(hm ? { elevationM: hm } : {}) }
    t.addActivity(a)
    onClose()
  }
  const native = useNativeShell()
  useNativeSheet(native ? {
    id: 'cardio', title: tr('sheets.cardio.title'), subtitle: L.fmtDate(date), detents: ['auto'],
    blocks: [
      { type: 'segmented', id: 'kind', options: [{ id: 'run', title: tr('logic.activity.run') }, { id: 'ride', title: tr('logic.activity.ride') }], selected: kind },
      { type: 'stepper', id: 'min', label: tr('sheets.cardio.minutes'), value: String(min) },
      { type: 'stepper', id: 'km', label: tr('sheets.cardio.km'), value: String(km) },
      { type: 'stepper', id: 'hm', label: tr('sheets.cardio.elevation'), value: String(hm) },
    ],
    footer: [{ id: 'save', title: tr('sheets.save'), symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'dismiss') onClose()
    else if (e.id === 'kind:run' || e.id === 'kind:ride') setKind(e.id.slice(5) as 'run' | 'ride')
    else if (e.id === 'min:minus') setMin(v => Math.max(5, v - 5))
    else if (e.id === 'min:plus') setMin(v => v + 5)
    else if (e.id === 'km:minus') setKm(v => Math.max(0, v - 1))
    else if (e.id === 'km:plus') setKm(v => v + 1)
    else if (e.id === 'hm:minus') setHm(v => Math.max(0, v - 50))
    else if (e.id === 'hm:plus') setHm(v => v + 50)
    else if (e.id === 'save') save()
  })
  if (native) return null
  return (
    <Sheet title={tr('sheets.cardio.title')} sub={L.fmtDate(date)} onClose={onClose}>
      <div className="seg" role="group" aria-label={tr('sheets.cardio.kind')}>
        {([['run', tr('logic.activity.run')], ['ride', tr('logic.activity.ride')]] as const).map(([k, l]) => (
          <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <div className="steppers">
        <Stepper label={tr('sheets.cardio.minutes')} value={min} step={5} min={5} onChange={setMin} />
        <Stepper label={tr('sheets.cardio.km')} value={km} step={1} min={0} onChange={setKm} />
      </div>
      <div className="steppers">
        <Stepper label={tr('sheets.cardio.elevation')} value={hm} step={50} min={0} onChange={setHm} />
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary" onClick={onClose}>{tr('sheets.cancel')}</button>
        <button className="btn btn-primary grow" onClick={save}>{tr('sheets.save')}</button>
      </div>
    </Sheet>
  )
}

/** Technik & Optionen einer Übung: voller Technik-Text, Stufe wechseln, Satzzahl, Überspringen, Pausieren */
export function ExerciseSheet({ t, slot, onClose }: { t: Training; slot: L.SlotView; onClose: () => void }) {
  const { step } = slot, ex = step.exercise
  const setStep = (id: string) => { t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: id } })); onClose() }
  return (
    <Sheet title={ex.name} sub={`${L.BLOCK_LABEL[slot.block]}${step.total > 1 ? ` · ${tr('logic.stage', { i: step.index + 1, n: step.total })}` : ''}${tr('sheets.target', { target: step.target.label })}`} onClose={onClose}>
      <dl className="technique-dl">
        <dt>{tr('sheets.exercise.setup')}</dt><dd>{ex.technique.setup}</dd>
        <dt>{tr('sheets.exercise.execution')}</dt><dd>{ex.technique.execution}</dd>
        <dt className="warn">{tr('sheets.exercise.faults')}</dt><dd>{ex.technique.faults}</dd>
        {ex.technique.scaling && <><dt>{tr('sheets.exercise.scaling')}</dt><dd>{ex.technique.scaling}</dd></>}
      </dl>
      {ex.media.videoQuery && (
        <a className="btn btn-secondary btn-block" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.media.videoQuery)}`} target="_blank" rel="noopener">
          <Icon name="play" /> {tr('sheets.exercise.video')}
        </a>
      )}
      <div className="sheet-grid">
        {step.prev && <button className="btn btn-secondary" onClick={() => setStep(step.prev!.id)}><Icon name="left" /> {step.prev.name}</button>}
        {step.next && <button className="btn btn-outline" onClick={() => setStep(step.next!.id)}>{step.next.name} <Icon name="right" /></button>}
        {slot.state === 'skipped'
          ? <button className="btn btn-ghost" onClick={() => { t.updateToday(x => L.withSkip(x, ex.id, false)); onClose() }}><Icon name="undo" /> {tr('sheets.exercise.undoSkip')}</button>
          : <button className="btn btn-ghost" onClick={() => { t.updateToday(x => L.withSkip(x, ex.id, true)); onClose() }}><Icon name="skip" /> {tr('sheets.exercise.skip')}</button>}
        {slot.state === 'paused'
          ? <button className="btn btn-ghost" onClick={() => { t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) })); onClose() }}><Icon name="undo" /> {tr('sheets.exercise.resume')}</button>
          : <button className="btn btn-ghost" onClick={() => { t.setState(st => ({ ...st, paused: [...new Set([...st.paused, slot.pid])] })); onClose() }}><Icon name="pause" /> {tr('sheets.exercise.pause')}</button>}
      </div>
    </Sheet>
  )
}

/** Technik & Optionen als natives iOS-Sheet: dieselben Inhalte und Aktionen wie ExerciseSheet */
export function exerciseSheetSpec(t: Training, slot: L.SlotView): { spec: SheetSpec; run: (id: string) => void } {
  const { step } = slot, ex = step.exercise
  const setStep = (id: string) => t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: id } }))
  const acts: (SheetSpec['actions'][number] & { run: () => void })[] = []
  if (ex.media.videoQuery) acts.push({ id: 'video', title: tr('sheets.exercise.video'), symbol: 'play.rectangle', run: () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.media.videoQuery!)}`, '_blank') })
  if (step.next) acts.push({ id: 'next', title: tr('sheets.exercise.next', { name: step.next.name }), symbol: 'arrow.up.right', style: 'prominent', run: () => setStep(step.next!.id) })
  if (step.prev) acts.push({ id: 'prev', title: tr('sheets.exercise.prev', { name: step.prev.name }), symbol: 'arrow.down.left', run: () => setStep(step.prev!.id) })
  acts.push(slot.state === 'skipped'
    ? { id: 'unskip', title: tr('sheets.exercise.undoSkip'), symbol: 'arrow.uturn.backward', run: () => t.updateToday(x => L.withSkip(x, ex.id, false)) }
    : { id: 'skip', title: tr('sheets.exercise.skip'), symbol: 'forward.end', run: () => t.updateToday(x => L.withSkip(x, ex.id, true)) })
  acts.push(slot.state === 'paused'
    ? { id: 'resume', title: tr('sheets.exercise.resume'), symbol: 'play', run: () => t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) })) }
    : { id: 'pause', title: tr('sheets.exercise.pause'), symbol: 'pause', style: 'destructive', run: () => t.setState(st => ({ ...st, paused: [...new Set([...st.paused, slot.pid])] })) })
  const spec: SheetSpec = {
    title: ex.name,
    subtitle: `${L.BLOCK_LABEL[slot.block]}${step.total > 1 ? ` · ${tr('logic.stage', { i: step.index + 1, n: step.total })}` : ''}${tr('sheets.target', { target: step.target.label })}`,
    sections: [
      { title: tr('sheets.exercise.setup'), text: ex.technique.setup },
      { title: tr('sheets.exercise.execution'), text: ex.technique.execution },
      { title: tr('sheets.exercise.faults'), text: ex.technique.faults, warn: true },
      ...(ex.technique.scaling ? [{ title: tr('sheets.exercise.scaling'), text: ex.technique.scaling }] : []),
    ],
    actions: acts.map(({ run: _run, ...a }) => a),
  }
  return { spec, run: id => acts.find(a => a.id === id)?.run() }
}
