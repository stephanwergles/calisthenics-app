'use client'
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'

type Sub = 'cal' | 'prog'

export type DayItem = { kind: 'session' | 'activity'; id: string }

/** Verlauf: Monat mit Kalender und allen Einheiten als Feed, daneben Fortschritt pro Übung */
export function HistoryView({ t, openActivity, openDay }: { t: Training; openActivity: (date: string) => void; openDay: (d: DayItem) => void }) {
  const [sub, setSub] = useState<Sub>('cal')
  const [month, setMonth] = useState(t.today.slice(0, 7))
  return (
    <section className="history">
      <span className="h-date">{sub === 'cal' ? (n => `${n} ${n === 1 ? 'Einheit' : 'Einheiten'} insgesamt`)(t.sessions.filter(L.isTrained).length) : 'Pro Übung, über alle Stufen'}</span>
      <h2 className="page-title display">Verlauf</h2>
      <div className="seg pill" role="group" aria-label="Ansicht">
        {([['cal', 'Monat'], ['prog', 'Fortschritt']] as const).map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} aria-pressed={sub === k} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>
      {sub === 'cal' ? <Month t={t} month={month} setMonth={setMonth} openActivity={openActivity} openDay={openDay} /> : <Progress t={t} />}
    </section>
  )
}

/* ── Monat ── */

function Month({ t, month, setMonth, openActivity, openDay }: {
  t: Training; month: string; setMonth: (m: string) => void; openActivity: (date: string) => void; openDay: (d: DayItem) => void
}) {
  const marks = useMemo(() => L.calendarMarks(t.sessions, t.activities), [t.sessions, t.activities])
  const grid = L.monthGrid(month)
  const stats = useMemo(() => L.monthStats(t.sessions, t.activities, month), [t.sessions, t.activities, month])
  const hours = Math.floor(stats.durationSec / 3600), mins = Math.round((stats.durationSec % 3600) / 60)
  // Feed: Einheiten und Cardio des Monats, neueste zuerst
  const feed = useMemo(() => [
    ...t.sessions.filter(s => s.date.startsWith(month) && L.isTrained(s)).map(s => ({ kind: 'session' as const, id: s.id, date: s.date, s })),
    ...t.activities.filter(a => a.date.startsWith(month)).map(a => ({ kind: 'activity' as const, id: a.id, date: a.date, a })),
  ].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.kind === 'session' ? -1 : 1)), [t.sessions, t.activities, month])
  const pickDay = (d: string) => {
    const hit = feed.find(f => f.date === d)
    if (hit) openDay({ kind: hit.kind, id: hit.id })
    else openActivity(d)
  }

  return (
    <>
      <div className="card hv-month">
        <div className="hv-head">
          <span className="display">{L.fmtMonth(month)}</span>
          <div className="hv-nav">
            <button className="btn btn-ghost btn-icon" aria-label="Voriger Monat" onClick={() => setMonth(L.shiftMonth(month, -1))}><Icon name="left" size={20} /></button>
            <button className="btn btn-ghost btn-icon" aria-label="Nächster Monat" disabled={month >= t.today.slice(0, 7)} onClick={() => setMonth(L.shiftMonth(month, 1))}><Icon name="right" size={20} /></button>
          </div>
        </div>
        <div className="hv-stats" aria-label={`Bilanz ${L.fmtMonth(month)}`}>
          <div><span className="num">{stats.sessions}</span><small>{stats.sessions === 1 ? 'Einheit' : 'Einheiten'}</small></div>
          <div><span className="num">{hours ? `${hours}:${String(mins).padStart(2, '0')}` : mins}</span><small>{hours ? 'Stunden' : 'Minuten'}</small></div>
          <div><span className="num">{stats.cardio}</span><small>Cardio</small></div>
        </div>
        <div className="cal-grid hv-cal">
          {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((w, i) => <span key={i} className="cal-w">{w}</span>)}
          {Array.from({ length: grid.lead }, (_, i) => <span key={`l${i}`} />)}
          {grid.days.map(d => {
            const cls = ['hv-day', marks.trained.has(d) && 'trained', marks.cardio.has(d) && 'cardio', d === t.today && 'today', d > t.today && 'future'].filter(Boolean).join(' ')
            const label = [L.fmtDate(d), marks.trained.has(d) && 'Training', marks.cardio.has(d) && 'Cardio'].filter(Boolean).join(', ')
            return <button key={d} className={cls} aria-label={label} disabled={d > t.today} onClick={() => pickDay(d)}><span className="num">{Number(d.slice(8))}</span></button>
          })}
        </div>
      </div>

      {feed.length === 0 && (
        <p className="empty">Keine Einheiten im {L.fmtMonth(month)}.<br />Sobald du einen Satz einträgst, erscheint der Tag hier.</p>
      )}
      <ol className="hv-feed">
        {feed.map(f => {
          const day = new Date(`${f.date}T12:00`)
          const date = (
            <span className="hv-date" aria-hidden="true">
              <small>{day.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</small>
              <span className="num">{day.getDate()}</span>
            </span>
          )
          if (f.kind === 'activity') return (
            <li key={f.id}>
              <button className="hv-item cardio" onClick={() => openDay({ kind: 'activity', id: f.id })}>
                {date}
                <span className="hv-main"><b className="display">{L.activityTitle(f.a)}</b><small>{L.fmtActivity(f.a) || 'Cardio'}</small></span>
                <Icon name="right" size={18} />
              </button>
            </li>
          )
          const w = t.ix.workouts.get(f.s.workout)
          const reps = f.s.sets.reduce((n, x) => n + (t.ix.exercises.get(x.exercise)?.unit === 'reps' ? x.value : 0), 0)
          return (
            <li key={f.id}>
              <button className="hv-item" onClick={() => openDay({ kind: 'session', id: f.id })}>
                {date}
                <span className="hv-main">
                  <b className="display">{w ? w.focus : f.s.workout}</b>
                  <small>{[w?.name, f.s.durationSec ? L.fmtDuration(f.s.durationSec) : null, `${f.s.sets.length} ${f.s.sets.length === 1 ? 'Satz' : 'Sätze'}`, reps ? `${reps} Wdh.` : null].filter(Boolean).join(' · ')}</small>
                </span>
                {f.s.note && <Icon name="note" size={16} className="hv-noteicon" />}
                <Icon name="right" size={18} />
              </button>
            </li>
          )
        })}
      </ol>
      <button className="btn btn-ghost btn-block" onClick={() => openActivity(month === t.today.slice(0, 7) ? t.today : `${month}-01`)}><Icon name="plus" size={18} /> Cardio eintragen</button>
    </>
  )
}

/** Tag im Verlauf als Sheet: alle Sätze und Notizen, unten Löschen */
export function DaySheet({ t, item, onClose }: { t: Training; item: DayItem; onClose: () => void }) {
  if (item.kind === 'activity') {
    const a = t.activities.find(x => x.id === item.id)
    if (!a) return null
    return (
      <Sheet title={L.activityTitle(a)} sub={L.fmtDate(a.date)} onClose={onClose}>
        {L.fmtActivity(a) && <p className="hv-sheet-meta">{L.fmtActivity(a)}</p>}
        {a.note && <p className="note-text"><Icon name="note" size={14} /><span>{a.note}</span></p>}
        <button className="btn btn-danger btn-block hv-delete" onClick={() => {
          if (confirm(`${L.activityTitle(a)} vom ${L.fmtDate(a.date)} löschen?`)) { t.removeActivity(a.id); onClose() }
        }}><Icon name="trash" size={18} /> Eintrag löschen</button>
      </Sheet>
    )
  }
  const s = t.sessions.find(x => x.id === item.id)
  if (!s) return null
  const w = t.ix.workouts.get(s.workout)
  const rows = L.sessionExercises(t.ix, s)
  const reps = s.sets.reduce((n, x) => n + (t.ix.exercises.get(x.exercise)?.unit === 'reps' ? x.value : 0), 0)
  const running = !!t.active && L.sessionId(L.localDate(new Date(t.active.start)), t.active.workout) === s.id
  return (
    <Sheet title={w ? w.focus : s.workout} sub={`${L.fmtDate(s.date)}${w ? ` · ${w.name}` : ''}`} onClose={onClose}
      footer={
        <button className="btn btn-danger btn-block" onClick={() => {
          const what = `${w?.name ?? 'Einheit'} vom ${L.fmtDate(s.date)} mit ${s.sets.length} ${s.sets.length === 1 ? 'Satz' : 'Sätzen'}`
          if (confirm(`${what} löschen?${running ? ' Das laufende Training wird dabei beendet.' : ''} Das lässt sich nicht rückgängig machen.`)) { t.removeSession(s.id); onClose() }
        }}><Icon name="trash" size={18} /> Training löschen</button>
      }>
      <ul className="f-facts hv-facts">
        {s.durationSec ? <li>{L.fmtDuration(s.durationSec)}</li> : null}
        <li>{s.sets.length} {s.sets.length === 1 ? 'Satz' : 'Sätze'}</li>
        {reps > 0 && <li>{reps} Wdh.</li>}
      </ul>
      {s.note && <p className="note-text"><Icon name="note" size={14} /><span>{s.note}</span></p>}
      <ul className="day-ex">
        {rows.map(r => (
          <li key={r.exercise.id}>
            <span className="day-ex-name">{r.exercise.name}</span>
            <span className="day-sets">
              {r.sets.map((x, i) => (
                <span key={i} className={`num day-set${x.note ? ' has-note' : ''}`} title={x.note}>
                  {x.value}{r.exercise.unit === 'seconds' ? <small>s</small> : null}{x.weightKg ? <small>+{x.weightKg}</small> : null}
                </span>
              ))}
            </span>
            {L.notesOf(r.sets).map(n => <span key={n.set} className="set-note">Satz {n.set}: {n.note}</span>)}
          </li>
        ))}
      </ul>
    </Sheet>
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
                <td>
                  {h.sets.map(x => `${x.value}${x.weightKg ? `+${x.weightKg}kg` : ''}${x.note ? '*' : ''}`).join(' · ')}
                  {L.notesOf(h.sets).map(n => <span key={n.set} className="set-note">Satz {n.set}: {n.note}</span>)}
                </td><td>{h.sum}</td>
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
