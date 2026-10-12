'use client'
import { useEffect, useState, type ReactNode } from 'react'
import type { Activity } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'
import { Icon } from './Icon'

export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="sheet-sub">{sub}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" aria-label="Schließen" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </>
  )
}

function Stepper({ label, value, step, min, unit, onChange }: { label: string; value: number; step: number; min: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button className="btn btn-secondary btn-icon" aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}><Icon name="minus" size={20} /></button>
        <output className="stepper-val">{value}{unit && <small>{unit}</small>}</output>
        <button className="btn btn-secondary btn-icon" aria-label={`${label} erhöhen`} onClick={() => onChange(+(value + step).toFixed(1))}><Icon name="plus" size={20} /></button>
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
  return (
    <Sheet title={ex.name} sub={`Satz ${setNo} von ${slot.planned} · Ziel ${target.label}`} onClose={onClose}>
      <div className="steppers">
        <Stepper label={seconds ? 'Sekunden' : 'Wiederholungen'} value={value} step={seconds ? 5 : 1} min={1} onChange={setValue} />
        {ex.weighted && <Stepper label="Zusatzgewicht" value={weight} step={2.5} min={0} unit="kg" onChange={setWeight} />}
      </div>
      {seconds && (
        <button className="btn btn-outline btn-block hold" onClick={() => rest.start(value)}>
          <Icon name="timer" /> {rest.running ? `${rest.remaining} s` : `Halte-Timer ${value} s`}
        </button>
      )}
      {noteOpen ? (
        <label className="field">
          <span className="field-label">Notiz zu diesem Satz</span>
          <textarea rows={2} maxLength={L.NOTE_MAX} value={note} placeholder="z. B. Ellenbogen gezwickt, mit Schwung"
            autoFocus={!existing?.note} onChange={e => setNote(e.target.value)} />
        </label>
      ) : (
        <button className="btn btn-ghost btn-block note-add" onClick={() => setNoteOpen(true)}><Icon name="note" /> Notiz hinzufügen</button>
      )}
      <div className="sheet-actions">
        {existing && <button className="btn btn-danger" onClick={() => { t.updateToday(s => L.withoutSet(s, ex.id, setNo)); onClose() }}>Löschen</button>}
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary grow" onClick={save}>Speichern</button>
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
  return (
    <Sheet title="Cardio" sub={L.fmtDate(date)} onClose={onClose}>
      <div className="seg" role="group" aria-label="Art">
        {([['run', 'Lauf'], ['ride', 'Rad']] as const).map(([k, l]) => (
          <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <div className="steppers">
        <Stepper label="Minuten" value={min} step={5} min={5} onChange={setMin} />
        <Stepper label="Kilometer" value={km} step={1} min={0} onChange={setKm} />
      </div>
      <div className="steppers">
        <Stepper label="Höhenmeter" value={hm} step={50} min={0} onChange={setHm} />
      </div>
      <div className="sheet-actions">
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary grow" onClick={save}>Speichern</button>
      </div>
    </Sheet>
  )
}

/** Technik & Optionen einer Übung: voller Technik-Text, Stufe wechseln, Satzzahl, Überspringen, Pausieren */
export function ExerciseSheet({ t, slot, onClose }: { t: Training; slot: L.SlotView; onClose: () => void }) {
  const { step } = slot, ex = step.exercise
  const setStep = (id: string) => { t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: id } })); onClose() }
  return (
    <Sheet title={ex.name} sub={`${L.BLOCK_LABEL[slot.block]}${step.total > 1 ? ` · Stufe ${step.index + 1}/${step.total}` : ''} · Ziel ${step.target.label}`} onClose={onClose}>
      <dl className="technique-dl">
        <dt>Ausgangsposition</dt><dd>{ex.technique.setup}</dd>
        <dt>Ausführung</dt><dd>{ex.technique.execution}</dd>
        <dt className="warn">Häufige Fehler</dt><dd>{ex.technique.faults}</dd>
        {ex.technique.scaling && <><dt>Leichter · Schwerer</dt><dd>{ex.technique.scaling}</dd></>}
      </dl>
      {ex.media.videoQuery && (
        <a className="btn btn-secondary btn-block" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.media.videoQuery)}`} target="_blank" rel="noopener">
          <Icon name="play" /> Tutorial auf YouTube
        </a>
      )}
      <div className="sheet-grid">
        {step.prev && <button className="btn btn-secondary" onClick={() => setStep(step.prev!.id)}><Icon name="left" /> {step.prev.name}</button>}
        {step.next && <button className="btn btn-outline" onClick={() => setStep(step.next!.id)}>{step.next.name} <Icon name="right" /></button>}
        <button className="btn btn-secondary" disabled={slot.planned <= 1} onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned - 1))}><Icon name="minus" /> Satz weniger</button>
        <button className="btn btn-secondary" onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned + 1))}><Icon name="plus" /> Satz mehr</button>
        {slot.state === 'skipped'
          ? <button className="btn btn-ghost" onClick={() => { t.updateToday(x => L.withSkip(x, ex.id, false)); onClose() }}><Icon name="undo" /> Doch machen</button>
          : <button className="btn btn-ghost" onClick={() => { t.updateToday(x => L.withSkip(x, ex.id, true)); onClose() }}><Icon name="skip" /> Heute überspringen</button>}
        {slot.state === 'paused'
          ? <button className="btn btn-ghost" onClick={() => { t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) })); onClose() }}><Icon name="undo" /> Wieder aufnehmen</button>
          : <button className="btn btn-ghost" onClick={() => { t.setState(st => ({ ...st, paused: [...new Set([...st.paused, slot.pid])] })); onClose() }}><Icon name="pause" /> Dauerhaft pausieren</button>}
      </div>
    </Sheet>
  )
}
