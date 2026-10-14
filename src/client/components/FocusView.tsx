'use client'
/* Fokus-Satz: eine Übung füllt den Screen – Skizze, Kernpunkte, riesiger Zähler, ein Button.
   Gedacht für den Daumen zwischen zwei Sätzen; die Erfassung liegt unten als angedocktes Sheet,
   Satzzahl ±1 direkt an den Satz-Kacheln. Technik, Stufe, Überspringen, Pausieren: Technik-Sheet. */
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PE } from 'react'
import * as L from '@/core/logic'
import type { Training } from '@/core/useTraining'
import type { RestTimer } from '@/core/useRestTimer'
import { useNow } from '@/core/useNow'
import { Icon } from './Icon'
import { ExerciseMedia } from './ExerciseMedia'
import { tap } from '../native'
import { t as tr, tn } from '@/core/i18n'
import { useHoldTimer, type HoldTimer } from '@/core/useHoldTimer'
import { useNativeShell, usePanel } from '../useNativeSheet'
import type { NPanel, PanelEvent } from '../native'
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
  /** laufende Pause wieder groß zeigen (Tipp auf die Uhr oben) */
  onRest: () => void
  /** iOS-App: natives Erfassungs-Panel zeigen (aus, solange Pause/Abschluss darüber liegen) */
  panel?: boolean
}

export function FocusView({ t, rest, slots, slot, drag, onMinimize, onList, onPick, openSet, openOptions, onSaved, onFinish, onRest, panel = false }: Props) {
  const now = useNow(!!t.active)
  const index = slot ? slots.findIndex(s => s.pid === slot.pid) : -1

  return (
    <section className="focus">
      <header className="f-top" {...drag}>
        <span className="grabber f-grabber" aria-hidden="true" />
        <button className="btn btn-secondary btn-icon f-min" aria-label={tr('training.focus.minimize')} onClick={onMinimize}><Icon name="down" size={22} /></button>
        <nav className="f-segs" aria-label={tr('training.focus.exercises')}>
          {slots.map(s => (
            <button key={s.pid} className={`f-seg ${s.state}${s.pid === slot?.pid ? ' current' : ''}`}
              aria-label={s.state === 'done' ? tr('training.focus.segDone', { name: s.step.exercise.name }) : s.step.exercise.name} aria-current={s.pid === slot?.pid ? 'step' : undefined}
              onClick={() => onPick(s.pid)}><i /></button>
          ))}
        </nav>
        {rest.running || rest.ringing
          ? <button className={`f-clock rest${rest.ringing ? ' ringing' : ''}`} onClick={onRest} aria-label={tr('training.focus.openRest')}>
              <Icon name="timer" size={16} />{rest.ringing ? '0:00' : L.fmtClock(rest.remaining)}
            </button>
          : <span className="f-clock num">{t.active ? L.fmtDuration(Math.max(0, now - t.active.start) / 1000) : ''}</span>}
        <button className="btn btn-secondary btn-icon f-list" aria-label={tr('training.focus.allExercises')} onClick={onList}><Icon name="list" size={20} /></button>
      </header>

      {!slot ? <AllDone onBack={onList} onFinish={t.active ? onFinish : undefined} /> : (
        <Exercise key={slot.pid} t={t} rest={rest} slot={slot} index={index} total={slots.length}
          openSet={openSet} openOptions={openOptions} onSaved={onSaved} panel={panel} />
      )}
    </section>
  )
}

function AllDone({ onBack, onFinish }: { onBack: () => void; onFinish?: () => void }) {
  return (
    <div className="f-done">
      <span className="display f-done-title">{tr('training.strong')}<span className="accent">.</span></span>
      <p>{tr('training.focus.allDone')}</p>
      {onFinish && <button className="btn btn-primary btn-block f-cta" onClick={onFinish}><Icon name="check" size={20} /> {tr('training.focus.finish')}</button>}
      <button className={`btn ${onFinish ? 'btn-secondary' : 'btn-primary f-cta'} btn-block`} onClick={onBack}><Icon name="list" /> {tr('training.focus.allExercises')}</button>
    </div>
  )
}

function Exercise({ t, rest, slot, index, total, openSet, openOptions, onSaved, panel }: {
  t: Training; rest: RestTimer; slot: L.SlotView; index: number; total: number
  openSet: (pid: string, setNo: number) => void; openOptions: (pid: string) => void; onSaved: (slot: L.SlotView, setNo: number, summary: string) => void
  panel: boolean
}) {
  const { step } = slot, ex = step.exercise, target = step.target
  const seconds = ex.unit === 'seconds'
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  const bars = Math.max(slot.planned, ...slot.sets.map(x => x.set))
  const muscles = ex.muscles ?? []
  const lastNotes = slot.last ? L.notesOf(slot.last.sets) : []
  // Erfassung als Sheet: eingeklappt Zähler + Speichern, hochgezogen zusätzlich Satz-Kacheln und Notiz.
  // Der Zusatzbereich folgt beim Ziehen 1:1 dem Finger und rastet beim Loslassen ein (Schwung oder halber Weg).
  const [expanded, setExpanded] = useState(false)
  const [dragH, setDragH] = useState<number | null>(null)
  const [full, setFull] = useState(0)
  const moreRef = useRef<HTMLDivElement>(null)
  const [note, setNote] = useState('')
  useEffect(() => { setNote('') }, [setNo])
  useLayoutEffect(() => {
    const el = moreRef.current
    if (!el) return
    const measure = () => setFull(el.scrollHeight)
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const onSheetDown = (e: PE) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // Buttons und Eingaben behalten ihre eigene Bedienung – gezogen wird auf der Fläche oder am Griff
    if (target.closest('button:not(.f-handle), input, textarea, label, a')) return
    const startY = e.clientY, startH = expanded ? full : 0
    let moved = false, lastY = startY, lastT = performance.now(), vel = 0
    const clampH = (y: number) => Math.min(full, Math.max(0, startH - (y - startY)))
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientY - startY) < 6) return
      moved = true
      const now = performance.now()
      vel = (ev.clientY - lastY) / Math.max(1, now - lastT); lastY = ev.clientY; lastT = now
      setDragH(clampH(ev.clientY))
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
      if (!moved) { if (target.closest('.f-handle')) setExpanded(x => !x); return }
      const h = clampH(ev.clientY)
      setExpanded(vel < -0.35 ? true : vel > 0.35 ? false : h > full / 2)
      setDragH(null)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
  }
  const moreH = dragH ?? (expanded ? full : 0)

  // iOS-App: Erfassung als natives Panel – hier Kacheln und Zustände, Zähler & Timer in SetInput
  const native = useNativeShell()
  const tiles: NPanel['tiles'] = Array.from({ length: bars }, (_, i) => {
    const v = slot.sets.find(x => x.set === i + 1)
    return { n: i + 1, text: v ? String(v.value) : '', sub: v?.weightKg ? `+${L.fmtNum(v.weightKg)}` : undefined,
      state: v ? 'done' : i + 1 === setNo ? 'current' : 'open', note: !!v?.note }
  })
  const canRemove = slot.planned > Math.max(1, ...slot.sets.map(x => x.set))
  const undoState = () => slot.state === 'skipped'
    ? t.updateToday(x => L.withSkip(x, ex.id, false))
    : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))
  const onTileEvent = (e: PanelEvent) => {
    if (e.type === 'tile') openSet(slot.pid, Number(e.value))
    else if (e.type === 'add') t.updateToday(x => L.withPlan(x, slot.pid, slot.planned + 1))
    else if (e.type === 'remove') t.updateToday(x => L.withPlan(x, slot.pid, slot.planned - 1))
    else if (e.type === 'state') undoState()
  }
  usePanel(native && panel && setNo === null ? {
    key: `${slot.pid}-state`, caption: '', value: '', seconds: false, timerPhase: 'idle', primary: 'save', tiles, canRemove,
    stateText: slot.state === 'skipped' ? tr('training.skippedToday') : slot.state === 'paused' ? tr('training.pausedUntil')
      : tn('training.focus.allLogged', slot.planned, { sets: slot.sets.map(x => L.fmtSet(x, ex)).join(' · ') }),
    stateButton: slot.state === 'skipped' ? tr('training.undoSkip') : slot.state === 'paused' ? tr('training.resume') : undefined,
  } : null, onTileEvent)

  return (
    <>
      <div className="f-scroll">
      <div className="f-figure">
        <span className="f-label">{L.BLOCK_LABEL[slot.block]} · {index + 1}/{total}{step.total > 1 && <span className="f-level"> · {tr('logic.stage', { i: step.index + 1, n: step.total })}</span>}</span>
        <button className="btn btn-secondary btn-sm f-opts" onClick={() => openOptions(slot.pid)}>{tr('training.focus.technique')}</button>
        <ExerciseMedia exercise={ex} label={tr('training.focus.movement', { name: ex.name })} />
        {/* Name und Muskeln liegen im Bild – alles Wichtige passt so über das Erfassungs-Sheet */}
        <div className="f-over">
          <h1 className="display f-name">{ex.name}</h1>
          {muscles.length > 0 && (
            <p className="f-muscles" aria-label={tr('training.focus.muscles')}>
              {muscles.map((m, i) => <span key={m} className={i < 2 ? 'main' : ''}>{m}</span>)}
            </p>
          )}
        </div>
      </div>

      {ex.cues?.length ? (
        <ol className="f-cues" aria-label={tr('training.focus.cues')}>
          {ex.cues.map((c, i) => <li key={i}><span className="num">{i + 1}</span>{c}</li>)}
        </ol>
      ) : <p className="f-exec">{ex.technique.execution}</p>}

      {lastNotes.map(n => (
        <p key={n.set} className="f-note"><Icon name="note" size={16} /><span>{tr('training.focus.lastNote', { set: n.set, note: n.note })}</span></p>
      ))}

      {slot.ready && step.next && (
        <button className="btn btn-outline btn-block" onClick={() => t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: step.next!.id } }))}>
          <Icon name="up" /> {tr('training.focus.readyFor', { name: step.next.name })}
        </button>
      )}

      </div>

      {native && setNo !== null && (
        <SetInput key={`${slot.pid}-${setNo}`} t={t} rest={rest} slot={slot} setNo={setNo} seconds={seconds} onSaved={onSaved}
          note="" onNoteToggle={() => undefined} panel={panel ? { tiles, canRemove, onTileEvent } : null} />
      )}
      {!native && <div className={`f-bottom${expanded ? ' expanded' : ''}`} role="region" aria-label={tr('training.focus.logSet')} onPointerDown={onSheetDown}>
        {/* Tastatur/Screenreader: Griff ist ein Button; Zeiger-Tipp schaltet in onSheetDown um */}
        <button className="f-handle" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(x => !x) } }}
          aria-expanded={expanded} aria-label={expanded ? tr('training.focus.collapse') : tr('training.focus.expand')}>
          <span className="grabber" aria-hidden="true" />
        </button>
        <div className={`f-more${dragH !== null ? ' dragging' : ''}`} style={{ height: moreH }} aria-hidden={!expanded}><div ref={moreRef}>
        <span className="f-more-label">{tr('training.focus.sets')}</span>
        <div className="f-bars">
          {Array.from({ length: bars }, (_, i) => {
            const v = slot.sets.find(x => x.set === i + 1)
            const cls = v ? 'done' : i + 1 === setNo ? 'current' : ''
            return (
              <button key={i} className={`f-bar ${cls}${v?.note ? ' has-note' : ''}`} onClick={() => openSet(slot.pid, i + 1)}
                aria-label={v ? tr('training.focus.setEdit', { set: i + 1, value: L.fmtSet(v, ex) }) : tr('training.focus.setLog', { set: i + 1 })}>
                <span className="num">{v ? v.value : ''}</span>
              </button>
            )
          })}
          {slot.planned > Math.max(1, ...slot.sets.map(x => x.set)) && (
            <button className="f-bar add" aria-label={tr('training.focus.setLess')} onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned - 1))}><Icon name="minus" size={14} /></button>
          )}
          <button className="f-bar add" aria-label={tr('training.focus.setMore')} onClick={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned + 1))}><Icon name="plus" size={14} /></button>
        </div>
        {setNo !== null && (
          <label className="field f-notefield">
            <span className="f-more-label">{tr('training.focus.noteSet', { set: setNo })}</span>
            <textarea rows={2} maxLength={L.NOTE_MAX} value={note} placeholder={tr('training.focus.noteSetPlaceholder')} onChange={e => setNote(e.target.value)} />
          </label>
        )}
        </div></div>

        {slot.state === 'skipped' || slot.state === 'paused' ? (
          <div className="f-state">
            <p>{slot.state === 'skipped' ? tr('training.skippedToday') : tr('training.pausedUntil')}</p>
            <button className="btn btn-secondary btn-block" onClick={() => slot.state === 'skipped'
              ? t.updateToday(x => L.withSkip(x, ex.id, false))
              : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))}>
              <Icon name="undo" /> {slot.state === 'skipped' ? tr('training.undoSkip') : tr('training.resume')}
            </button>
          </div>
        ) : setNo === null ? (
          <div className="f-state">
            <p><Icon name="check" /> {tn('training.focus.allLogged', slot.planned, { sets: slot.sets.map(x => L.fmtSet(x, ex)).join(' · ') })}</p>
          </div>
        ) : (
          <SetInput key={`${slot.pid}-${setNo}`} t={t} rest={rest} slot={slot} setNo={setNo} seconds={seconds} onSaved={onSaved}
            note={note} onNoteToggle={() => setExpanded(x => !x)} />
        )}
      </div>}
    </>
  )
}

/** Erfassung des nächsten Satzes direkt im Screen – Vorbelegung wie im Satz-Editor */
function SetInput({ t, rest, slot, setNo, seconds, onSaved, note, onNoteToggle, panel }: {
  t: Training; rest: RestTimer; slot: L.SlotView; setNo: number; seconds: boolean; onSaved: (slot: L.SlotView, setNo: number, summary: string) => void
  note: string; onNoteToggle: () => void
  /** gesetzt = als natives Panel zeigen statt im Web */
  panel?: { tiles: NPanel['tiles']; canRemove: boolean; onTileEvent: (e: PanelEvent) => void } | null
}) {
  const ex = slot.step.exercise, target = slot.step.target
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const stepBy = seconds ? 5 : 1
  // Halteübungen: Timer mit Vorlauf; bis er durch ist, ist „Timer starten“ die Hauptaktion
  const hold = useHoldTimer()
  const timing = hold.phase === 'prep' || hold.phase === 'hold'
  const timerFirst = seconds && hold.phase !== 'done'

  const save = (noteText?: string) => {
    const n = L.cleanNote(noteText ?? note)
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}), ...(n ? { note: n } : {}) }))
    t.startSession()
    tap()
    rest.start(target.restSec)
    // Rückmeldung für den Pausen-Screen: Wert und Vergleich zum gleichen Satz beim letzten Mal
    const before = slot.last?.sets.find(x => x.set === setNo)
    const d = before ? value - before.value : null
    const unit = seconds ? 's' : tr('training.unitReps')
    onSaved(slot, setNo, `${value}${weight ? ` +${weight} kg` : ''} ${unit}${d === null ? '' : d === 0 ? tr('training.focus.sameAsLast') : tr('training.focus.vsLast', { d: `${d > 0 ? '+' : '−'}${Math.abs(d)}` })}`)
  }

  // Ziel und letzter Wert stehen direkt über dem Zähler (statt als Chips im verdeckten Inhalt)
  const lastSet = slot.last?.sets.find(x => x.set === setNo)
  const caption = `${tr('training.focus.caption', { set: setNo, planned: slot.planned, target: target.label })}${lastSet ? tr('training.focus.captionLast', { value: `${lastSet.value}${seconds ? ' s' : ''}${lastSet.weightKg ? ` +${L.fmtNum(lastSet.weightKg)} kg` : ''}` }) : ''}`
  usePanel(panel ? {
    key: `${slot.pid}-${setNo}`, caption, value: String(value), unit: seconds ? 's' : undefined,
    weight: ex.weighted ? L.fmtNum(weight) : undefined, seconds,
    timerPhase: hold.phase, timerLeft: hold.left, timerShare: Math.round(hold.share * 1000) / 1000,
    timerTitle: timing ? tr('training.focus.cancelTimer') : hold.phase === 'done' ? tr('training.focus.again', { n: value }) : tr('training.focus.startTimer', { n: value }),
    primary: timerFirst ? 'timer' : 'save', doneHint: hold.phase === 'done' ? tr('training.focus.held', { n: value }) : undefined,
    tiles: panel.tiles, canRemove: panel.canRemove,
  } : null, e => {
    if (e.type === 'minus') setValue(v => Math.max(1, v - stepBy))
    else if (e.type === 'plus') setValue(v => v + stepBy)
    else if (e.type === 'wminus') setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))
    else if (e.type === 'wplus') setWeight(w => +(w + 2.5).toFixed(1))
    else if (e.type === 'timer') hold.start(value)
    else if (e.type === 'cancel') hold.cancel()
    else if (e.type === 'save') save(String(e.value ?? ''))
    else panel?.onTileEvent(e)
  })
  if (panel !== undefined) return null

  return (
    <>
      <p className="f-caption">{caption}</p>
      {timing ? <HoldRing hold={hold} /> : (
        <div className="f-counter">
          <button className="f-round" aria-label={tr('training.focus.less', { n: stepBy })} onClick={() => setValue(v => Math.max(1, v - stepBy))}><Icon name="minus" size={28} /></button>
          <output className="num f-value" aria-live="polite">{value}{seconds && <small>s</small>}</output>
          <button className="f-round" aria-label={tr('training.focus.more', { n: stepBy })} onClick={() => setValue(v => v + stepBy)}><Icon name="plus" size={28} /></button>
        </div>
      )}
      {ex.weighted && (
        <div className="f-weight">
          <span>{tr('training.focus.weight')}</span>
          <button className="btn btn-secondary btn-icon" aria-label={tr('training.focus.weightLess')} onClick={() => setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))}><Icon name="minus" /></button>
          <output className="num">{L.fmtNum(weight)} <small>kg</small></output>
          <button className="btn btn-secondary btn-icon" aria-label={tr('training.focus.weightMore')} onClick={() => setWeight(w => +(w + 2.5).toFixed(1))}><Icon name="plus" /></button>
        </div>
      )}
      {seconds && (timing
        ? <button className="btn btn-secondary btn-block f-timer" onClick={hold.cancel}><Icon name="close" size={20} /> {tr('training.focus.cancelTimer')}</button>
        : <button className={`btn ${timerFirst ? 'btn-primary' : 'btn-outline'} btn-block f-timer`} onClick={() => hold.start(value)}>
            <Icon name="timer" size={22} /> {hold.phase === 'done' ? tr('training.focus.again', { n: value }) : tr('training.focus.startTimer', { n: value })}
          </button>)}
      {hold.phase === 'done' && <p className="f-holddone"><Icon name="check" size={16} /> {tr('training.focus.held', { n: value })}</p>}
      <div className="f-actions">
        <button className={`btn btn-secondary f-notebtn${note.trim() ? ' on' : ''}`} aria-label={tr('training.focus.noteThisSet')} onClick={onNoteToggle}>
          <Icon name="note" size={22} />
        </button>
        <button className={`btn ${timerFirst ? 'btn-secondary' : 'btn-primary'} grow f-cta`} onClick={() => save()}><Icon name="check" size={22} /> {tr('training.focus.saveSet')}</button>
      </div>
    </>
  )
}

const HR = 92, HC = 2 * Math.PI * HR

/** Großer Ring während des Halte-Timers: erst Vorlauf zum Positionieren, dann Halten */
function HoldRing({ hold }: { hold: HoldTimer }) {
  const prep = hold.phase === 'prep'
  return (
    <div className={`f-hold${prep ? ' prep' : ''}`} role="timer" aria-live="assertive">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={HR} className="fh-track" />
        <circle cx="100" cy="100" r={HR} className="fh-arc" strokeDasharray={`${(hold.share * HC).toFixed(1)} ${HC.toFixed(1)}`} transform="rotate(-90 100 100)" />
      </svg>
      <div className="fh-center">
        <span className="num fh-time">{hold.left}</span>
        <small>{prep ? tr('training.focus.inPosition') : tr('training.focus.hold')}</small>
      </div>
    </div>
  )
}
