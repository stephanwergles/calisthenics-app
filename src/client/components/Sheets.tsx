'use client'
import { useEffect, useState, type ReactNode } from 'react'
import type { Activity } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'

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
        <h3>{title}</h3>
        {sub && <p className="sheet-sub">{sub}</p>}
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
        <button className="btn btn-secondary btn-icon" aria-label={`${label} verringern`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))}>−</button>
        <output className="stepper-val">{value}{unit && <small>{unit}</small>}</output>
        <button className="btn btn-secondary btn-icon" aria-label={`${label} erhöhen`} onClick={() => onChange(+(value + step).toFixed(1))}>+</button>
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
  const seconds = ex.unit === 'seconds'

  const save = () => {
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}) }))
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
          ⏱ {rest.running ? `${rest.remaining} s` : `Halte-Timer ${value} s`}
        </button>
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
export function ActivitySheet({ t, onClose }: { t: Training; onClose: () => void }) {
  const [kind, setKind] = useState<'run' | 'ride'>('run')
  const [min, setMin] = useState(20)
  const [km, setKm] = useState(0)
  const [hm, setHm] = useState(0)
  const save = () => {
    const n = t.activities.filter(a => a.date === t.today && a.kind === kind).length
    const a: Activity = { id: `${t.today}-${kind}-${n + 1}`, date: t.today, kind, durationMin: min, ...(km ? { distanceKm: km } : {}), ...(hm ? { elevationM: hm } : {}) }
    t.addActivity(a)
    onClose()
  }
  return (
    <Sheet title="Cardio" sub={L.fmtDate(t.today)} onClose={onClose}>
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
