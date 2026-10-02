'use client'
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'

type Sub = 'cal' | 'prog'

/** Verlauf: Kalender mit Tagesansicht und Fortschritt pro Übung */
export function HistoryView({ t, openActivity }: { t: Training; openActivity: (date: string) => void }) {
  const [sub, setSub] = useState<Sub>('cal')
  return (
    <section className="history">
      <div className="seg" role="group" aria-label="Ansicht">
        {([['cal', 'Kalender'], ['prog', 'Fortschritt']] as const).map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} aria-pressed={sub === k} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>
      {sub === 'cal' ? <Calendar t={t} openActivity={openActivity} /> : <Progress t={t} />}
    </section>
  )
}

/* ── Kalender ── */

function Calendar({ t, openActivity }: { t: Training; openActivity: (date: string) => void }) {
  const [month, setMonth] = useState(t.today.slice(0, 7))
  const [sel, setSel] = useState(t.today)
  const marks = useMemo(() => L.calendarMarks(t.sessions, t.activities), [t.sessions, t.activities])
  const grid = L.monthGrid(month)
  const atToday = sel === t.today && month === t.today.slice(0, 7)

  const sessions = t.sessions.filter(s => s.date === sel && L.isTrained(s))
  const activities = t.activities.filter(a => a.date === sel)
  const anything = marks.trained.size > 0 || marks.cardio.size > 0

  return (
    <>
      <div className="card cal">
        <div className="cal-head">
          <span className="display">{L.fmtMonth(month)}</span>
          <div className="cal-ctrl">
            {!atToday && <button className="btn btn-outline btn-sm" onClick={() => { setSel(t.today); setMonth(t.today.slice(0, 7)) }}>Heute</button>}
            <button className="btn btn-secondary btn-icon" aria-label="Voriger Monat" onClick={() => setMonth(L.shiftMonth(month, -1))}>‹</button>
            <button className="btn btn-secondary btn-icon" aria-label="Nächster Monat" onClick={() => setMonth(L.shiftMonth(month, 1))}>›</button>
          </div>
        </div>
        <div className="cal-grid">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => <span key={w} className="cal-w">{w}</span>)}
          {Array.from({ length: grid.lead }, (_, i) => <span key={`l${i}`} />)}
          {grid.days.map(d => {
            const cls = ['cal-day', marks.trained.has(d) && 'trained', marks.cardio.has(d) && 'cardio', d === t.today && 'today', d === sel && 'sel'].filter(Boolean).join(' ')
            const label = [L.fmtDate(d), marks.trained.has(d) && 'Training', marks.cardio.has(d) && 'Cardio'].filter(Boolean).join(', ')
            return <button key={d} className={cls} aria-label={label} aria-pressed={d === sel} onClick={() => setSel(d)}>{Number(d.slice(8))}</button>
          })}
        </div>
      </div>

      {!anything ? (
        <p className="empty">Noch keine Einheiten.<br />Sobald du im Training einen Satz einträgst, erscheint der Tag hier orange.</p>
      ) : !sessions.length && !activities.length ? (
        <p className="empty">Nichts eingetragen am {L.fmtDate(sel)}<br />Orange markierte Tage haben Einträge.</p>
      ) : null}

      {sessions.map(s => {
        const w = t.ix.workouts.get(s.workout)
        const rows = L.sessionExercises(t.ix, s)
        return (
          <div key={s.id} className="card day">
            <h3>{w ? `${w.name} · ${w.focus}` : s.workout}</h3>
            <p className="meta">{L.fmtDate(s.date)}{s.durationSec ? ` · ${L.fmtDuration(s.durationSec)}` : ''} · {s.sets.length} Sätze</p>
            {rows.length > 0 && (
              <table>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.exercise.id}><td>{r.exercise.name}</td><td>{r.sets.map((x, i) => <span key={i} className="nw">{i > 0 && ' · '}{L.fmtSet(x, r.exercise)}</span>)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {activities.map(a => (
        <div key={a.id} className="card day">
          <div className="day-head">
            <h3>{L.activityTitle(a)}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`${L.activityTitle(a)} vom ${L.fmtDate(a.date)} löschen?`)) t.removeActivity(a.id) }}>Löschen</button>
          </div>
          <p className="meta">{L.fmtDate(a.date)}{L.fmtActivity(a) ? ` · ${L.fmtActivity(a)}` : ''}</p>
        </div>
      ))}

      <button className="btn btn-outline btn-block" onClick={() => openActivity(sel)}>+ Cardio am {L.fmtDate(sel)}</button>
    </>
  )
}

/* ── Fortschritt ── */

function Progress({ t }: { t: Training }) {
  const groups = useMemo(() => L.progressOverview(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length) return <p className="empty">Noch keine Daten.<br />Nach deiner ersten Einheit siehst du hier pro Übung, wie es sich entwickelt.</p>
  return (
    <>
      <p className="pg-key">
        <span>Balken = Summe pro Einheit</span>
        <span><i className="k-last" /> letzte Einheit</span>
        <span><i className="k-step" /> Stufenwechsel</span>
        <span>Antippen für alle Werte</span>
      </p>
      {groups.map(g => (
        <div key={g.workout.id}>
          <h3 className="pg-day"><span className="display">{g.workout.name}</span><span>{g.workout.focus}</span></h3>
          {g.tiles.map(p => <Tile key={p.pid} p={p} open={open === p.pid} toggle={() => setOpen(open === p.pid ? null : p.pid)} />)}
        </div>
      ))}
    </>
  )
}

function Tile({ p, open, toggle }: { p: L.ProgressSummary; open: boolean; toggle: () => void }) {
  const ex = p.step.exercise
  const unit = ex.unit === 'seconds' ? 's' : 'Wdh.'
  const delta = !p.last ? 'neue Stufe, noch nicht trainiert'
    : p.delta === null ? (p.step.index > 0 ? 'erste Einheit auf dieser Stufe' : 'erste Einheit')
    : `${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '± '}${Math.abs(p.delta)} seit ${L.fmtShortDate(p.prev!.date)}`
  const meta = [
    p.step.total > 1 ? `Stufe ${p.step.index + 1}/${p.step.total}` : null,
    `${p.current.length} Einheit${p.current.length === 1 ? '' : 'en'}`,
    p.best !== null ? `bester Satz ${p.best}${ex.unit === 'seconds' ? ' s' : ''}` : null,
    p.weightKg ? `bis +${p.weightKg} kg` : null,
    p.paused ? 'pausiert' : p.ready ? `bereit für ${p.step.next!.name}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <div className={`card pg-tile${p.paused ? ' paused' : ''}`}>
      <button className="pg-btn" aria-expanded={open} onClick={toggle}>
        <span className="pg-head"><span className="pg-name">{ex.name}</span><span className="pg-val">{p.last ? p.last.sum : '–'}<small>{unit}</small></span></span>
        <span className="pg-meta">{meta}</span>
        <span className="pg-foot">
          <span className={`pg-delta${p.delta === null || p.delta === 0 ? ' flat' : ''}`}>{delta}</span>
          <Spark points={p.history} unit={unit} />
        </span>
      </button>
      {open && (
        <table className="pg-tbl">
          <thead><tr><th>Datum</th><th>Stufe</th><th>Sätze</th><th>Σ</th></tr></thead>
          <tbody>
            {p.history.slice(-12).reverse().map((h, i) => (
              <tr key={`${h.date}-${h.step}-${i}`}>
                <td>{L.fmtShortDate(h.date)}</td><td>{h.step + 1}</td>
                <td>{h.sets.map(x => `${x.value}${x.weightKg ? `+${x.weightKg}kg` : ''}`).join(' · ')}</td><td>{h.sum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Mini-Balkendiagramm der letzten 12 Einheiten: grau, jüngste orange, Stufenwechsel als Linie.
    #6a6a6a hält 3:1 auf --card und ist für Farbfehlsichtige vom Orange getrennt (aus v1 übernommen). */
function Spark({ points, unit }: { points: L.HistoryPoint[]; unit: string }) {
  const pts = points.slice(-12), slot = 12, bw = 8, H = 40, W = 12 * slot
  const max = Math.max(1, ...pts.map(p => p.sum))
  const off = (12 - pts.length) * slot   // rechtsbündig: die jüngste Einheit steht immer rechts außen
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
      aria-label={`Summe der letzten ${pts.length} Einheiten: ${pts.map(p => p.sum).join(', ')}`}>
      {pts.map((p, i) => {
        const x = off + i * slot + 2, bh = Math.max(3, Math.round((p.sum / max) * (H - 2))), y = H - bh, r = Math.min(4, bh)
        return (
          <g key={i}>
            {i > 0 && p.step !== pts[i - 1].step && <line className="sp-step" x1={x - 2} x2={x - 2} y1={0} y2={H} />}
            <path className={`sp-bar${i === pts.length - 1 ? ' last' : ''}`}
              d={`M${x},${H}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + bw - r}A${r},${r} 0 0 1 ${x + bw},${y + r}V${H}Z`}>
              <title>{`${L.fmtDate(p.date)}: ${p.sum} ${unit}`}</title>
            </path>
          </g>
        )
      })}
    </svg>
  )
}
