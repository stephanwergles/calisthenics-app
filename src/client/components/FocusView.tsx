'use client'
/* Fokus-Satz: eine Übung füllt den Screen – Skizze, Kernpunkte, riesiger Zähler, ein Button.
   Gedacht für den Daumen zwischen zwei Sätzen; die Erfassung liegt unten als angedocktes Sheet,
   Satzzahl ±1 direkt an den Satz-Kacheln. Technik, Stufe, Überspringen, Pausieren: Technik-Sheet. */
import { useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RestTimer } from '../useRestTimer'
import { useNow } from '../useNow'
import { Icon } from './Icon'
import { Sketch } from './Sketch'
import { tap } from '../native'
import { useDrag } from '../useSheet'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react'

interface Props {
  t: Training
  rest: RestTimer
  slots: L.SlotView[]
  slot: L.SlotView | undefined
  drag: { onPointerDown: (e: ReactPointerEvent) => void; onClickCapture: (e: ReactMouseEvent) => void }
  onMinimize: () => void
  onList: () => void
  onPick: (pid: string) => void
  openSet: (pid: string, setNo: number) => void
  openOptions: (pid: string) => void
  onSaved: (slot: L.SlotView, setNo: number, summary: string) => void
  onFinish: () => void
}

export function FocusView({ t, rest, slots, slot, drag, onMinimize, onList, onPick, openSet, openOptions, onSaved, onFinish }: Props) {
  const now = useNow(!!t.active)
  const index = slot ? slots.findIndex(s => s.pid === slot.pid) : -1

  return (
    <section className="focus">
      <header className="f-top" {...drag}>
        <span className="grabber f-grabber" aria-hidden="true" />
        <button className="btn btn-secondary btn-icon f-min" aria-label="Training minimieren" onClick={onMinimize}><Icon name="down" size={22} /></button>
        <nav className="f-segs" aria-label="Übungen">
          {slots.map(s => (
            <button key={s.pid} className={`f-seg ${s.state}${s.pid === slot?.pid ? ' current' : ''}`}
              aria-label={`${s.step.exercise.name}${s.state === 'done' ? ', erledigt' : ''}`} aria-current={s.pid === slot?.pid ? 'step' : undefined}
              onClick={() => onPick(s.pid)}><i /></button>
          ))}
        </nav>
        {rest.running || rest.ringing
          ? <span className={`f-clock rest${rest.ringing ? ' ringing' : ''}`}><Icon name="timer" size={16} />{rest.ringing ? '0:00' : L.fmtClock(rest.remaining)}</span>
          : <span className="f-clock num">{t.active ? L.fmtDuration(Math.max(0, now - t.active.start) / 1000) : ''}</span>}
        <button className="btn btn-secondary btn-icon f-list" aria-label="Alle Übungen" onClick={onList}><Icon name="list" size={20} /></button>
      </header>

      {!slot ? <AllDone onBack={onList} onFinish={t.active ? onFinish : undefined} /> : (
        <Exercise key={slot.pid} t={t} rest={rest} slot={slot} index={index} total={slots.length}
          openSet={openSet} openOptions={openOptions} onSaved={onSaved} />
      )}
    </section>
  )
}

function AllDone({ onBack, onFinish }: { onBack: () => void; onFinish?: () => void }) {
  return (
    <div className="f-done">
      <span className="display f-done-title">Stark<span className="accent">.</span></span>
      <p>Alle Übungen erledigt oder übersprungen. In der Übersicht warten Cool-down und deine Notiz zur Einheit.</p>
      {onFinish && <button className="btn btn-primary btn-block f-cta" onClick={onFinish}><Icon name="check" size={20} /> Training beenden</button>}
      <button className={`btn ${onFinish ? 'btn-secondary' : 'btn-primary f-cta'} btn-block`} onClick={onBack}><Icon name="list" /> Alle Übungen</button>
    </div>
  )
}

function Exercise({ t, rest, slot, index, total, openSet, openOptions, onSaved }: {
  t: Training; rest: RestTimer; slot: L.SlotView; index: number; total: number
  openSet: (pid: string, setNo: number) => void; openOptions: (pid: string) => void; onSaved: (slot: L.SlotView, setNo: number, summary: string) => void
}) {
  const { step } = slot, ex = step.exercise, target = step.target
  const seconds = ex.unit === 'seconds'
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  const bars = Math.max(slot.planned, ...slot.sets.map(x => x.set))
  const muscles = ex.muscles ?? []
  const lastNotes = slot.last ? L.notesOf(slot.last.sets) : []
  // Erfassung als Sheet: eingeklappt nur Zähler + Speichern, hochgezogen auch Satz-Kacheln, Notiz, Halte-Timer
  const [expanded, setExpanded] = useState(false)
  const sheetDrag = useDrag({ up: true, threshold: 50, onUp: () => setExpanded(true), onDown: () => setExpanded(false) })

  return (
    <>
      <div className="f-scroll">
      <div className="f-figure">
        <span className="f-label">{L.BLOCK_LABEL[slot.block]} · {index + 1}/{total}{step.total > 1 && <span className="f-level"> · Stufe {step.index + 1}/{step.total}</span>}</span>
        <button className="btn btn-secondary btn-sm f-opts" onClick={() => openOptions(slot.pid)}>Technik</button>
        <Sketch id={ex.media.sketch} label={`Skizze: ${ex.name}`} />
      </div>

      <div className="f-head">
        <h1 className="display f-name">{ex.name}</h1>
        {muscles.length > 0 && (
          <ul className="f-chips" aria-label="Muskeln">
            {muscles.map((m, i) => <li key={m} className={i < 2 ? 'main' : ''}>{m}</li>)}
          </ul>
        )}
      </div>

      {ex.cues?.length ? (
        <ol className="f-cues" aria-label="Worauf es ankommt">
          {ex.cues.map((c, i) => <li key={i}><span className="num">{i + 1}</span>{c}</li>)}
        </ol>
      ) : <p className="f-exec">{ex.technique.execution}</p>}

      <ul className="f-facts">
        <li>Ziel {target.label}</li>
        <li>Pause {L.fmtClock(target.restSec)}</li>
        {slot.last && <li className="muted">Zuletzt {slot.last.sets.map(x => `${x.value}${x.weightKg ? `+${x.weightKg}` : ''}`).join(' · ')}</li>}
      </ul>
      {lastNotes.map(n => (
        <p key={n.set} className="f-note"><Icon name="note" size={16} /><span>Letztes Mal, Satz {n.set}: „{n.note}“</span></p>
      ))}

      {slot.ready && step.next && (
        <button className="btn btn-outline btn-block" onClick={() => t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: step.next!.id } }))}>
          <Icon name="up" /> Bereit für: {step.next.name}
        </button>
      )}

      </div>

      <div className={`f-bottom${expanded ? ' expanded' : ''}`} style={sheetDrag.style} role="region" aria-label="Satz erfassen">
        <button className="f-handle" {...sheetDrag.bind} onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded} aria-label={expanded ? 'Erfassung einklappen' : 'Mehr Optionen: Sätze, Notiz'}>
          <span className="grabber" aria-hidden="true" />
        </button>
        <div className="f-more"><div>
        <div className="f-bars">
          {Array.from({ length: bars }, (_, i) => {
            const v = slot.sets.find(x => x.set === i + 1)
            const cls = v ? 'done' : i + 1 === setNo ? 'current' : ''
            return (
              <button key={i} className={`f-bar ${cls}${v?.note ? ' has-note' : ''}`} onClick={() => openSet(slot.pid, i + 1)}
                aria-label={v ? `Satz ${i + 1}: ${L.fmtSet(v, ex)} – ändern` : `Satz ${i + 1} erfassen`}>
                <span className="num">{v ? v.value : ''}</span>
              </button>
            )
          })}
          {slot.planned > Math.max(1, ...slot.sets.map(x => x.set)) && (
            <button className="f-bar add" aria-label="Einen Satz weniger" onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned - 1))}><Icon name="minus" size={14} /></button>
          )}
          <button className="f-bar add" aria-label="Einen Satz mehr" onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned + 1))}><Icon name="plus" size={14} /></button>
        </div>
        </div></div>

        {slot.state === 'skipped' || slot.state === 'paused' ? (
          <div className="f-state">
            <p>{slot.state === 'skipped' ? 'Heute übersprungen.' : 'Pausiert, bis du sie wieder aufnimmst.'}</p>
            <button className="btn btn-secondary btn-block" onClick={() => slot.state === 'skipped'
              ? t.updateToday(x => L.withSkip(x, ex.id, false))
              : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))}>
              <Icon name="undo" /> {slot.state === 'skipped' ? 'Doch machen' : 'Wieder aufnehmen'}
            </button>
          </div>
        ) : setNo === null ? (
          <div className="f-state">
            <p><Icon name="check" /> Alle {slot.planned} Sätze erfasst: {slot.sets.map(x => L.fmtSet(x, ex)).join(' · ')}</p>
          </div>
        ) : (
          <SetInput key={`${slot.pid}-${setNo}`} t={t} rest={rest} slot={slot} setNo={setNo} seconds={seconds} onSaved={onSaved}
            expanded={expanded} onExpand={() => setExpanded(true)} />
        )}
      </div>
    </>
  )
}

/** Erfassung des nächsten Satzes direkt im Screen – Vorbelegung wie im Satz-Editor */
function SetInput({ t, rest, slot, setNo, seconds, onSaved, expanded, onExpand }: {
  t: Training; rest: RestTimer; slot: L.SlotView; setNo: number; seconds: boolean; onSaved: (slot: L.SlotView, setNo: number, summary: string) => void
  expanded: boolean; onExpand: () => void
}) {
  const ex = slot.step.exercise, target = slot.step.target
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const stepBy = seconds ? 5 : 1
  const holding = rest.running

  const save = () => {
    const n = L.cleanNote(note)
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}), ...(n ? { note: n } : {}) }))
    t.startSession()
    tap()
    rest.start(target.restSec)
    // Rückmeldung für den Pausen-Screen: Wert und Vergleich zum gleichen Satz beim letzten Mal
    const before = slot.last?.sets.find(x => x.set === setNo)
    const d = before ? value - before.value : null
    const unit = seconds ? 's' : 'Wdh.'
    onSaved(slot, setNo, `${value}${weight ? ` +${weight} kg` : ''} ${unit}${d === null ? '' : d === 0 ? ' · wie letztes Mal' : ` · ${d > 0 ? '+' : '−'}${Math.abs(d)} zum letzten Mal`}`)
  }

  return (
    <>
      <p className="f-caption">Satz {setNo} von {slot.planned} · {seconds ? 'Sekunden' : 'Wiederholungen'}{ex.perSide ? ' pro Seite' : ''}</p>
      <div className="f-counter">
        <button className="f-round" aria-label={`${stepBy} weniger`} onClick={() => setValue(v => Math.max(1, v - stepBy))}><Icon name="minus" size={28} /></button>
        <output className="num f-value" aria-live="polite">{value}{seconds && <small>s</small>}</output>
        <button className="f-round" aria-label={`${stepBy} mehr`} onClick={() => setValue(v => v + stepBy)}><Icon name="plus" size={28} /></button>
      </div>
      {ex.weighted && (
        <div className="f-weight">
          <span>Zusatzgewicht</span>
          <button className="btn btn-secondary btn-icon" aria-label="2,5 kg weniger" onClick={() => setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))}><Icon name="minus" /></button>
          <output className="num">{String(weight).replace('.', ',')} <small>kg</small></output>
          <button className="btn btn-secondary btn-icon" aria-label="2,5 kg mehr" onClick={() => setWeight(w => +(w + 2.5).toFixed(1))}><Icon name="plus" /></button>
        </div>
      )}
      {seconds && (
        <button className="btn btn-outline btn-block" onClick={() => rest.start(value)}>
          <Icon name="timer" /> {holding ? `Halten … ${rest.remaining} s` : `Halte-Timer ${value} s`}
        </button>
      )}
      {noteOpen && expanded && (
        <label className="field f-notefield">
          <span className="field-label">Notiz zu diesem Satz</span>
          <textarea rows={2} maxLength={L.NOTE_MAX} value={note} autoFocus placeholder="z. B. Ellenbogen gezwickt" onChange={e => setNote(e.target.value)} />
        </label>
      )}
      <div className="f-actions">
        <button className={`btn btn-secondary f-notebtn${noteOpen ? ' on' : ''}`} aria-label="Notiz zu diesem Satz" aria-pressed={noteOpen && expanded} onClick={() => { if (noteOpen && expanded) setNoteOpen(false); else { setNoteOpen(true); onExpand() } }}>
          <Icon name="note" size={22} />
        </button>
        <button className="btn btn-primary grow f-cta" onClick={save}><Icon name="check" size={22} /> Satz speichern</button>
      </div>
    </>
  )
}
