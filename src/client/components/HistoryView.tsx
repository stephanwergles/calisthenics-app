'use client'
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { RoutineItem, Session, SetLog } from '@/domain/model'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ask, type NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { intl, t as tr, tn, getLocale } from '../i18n'

type Sub = 'cal' | 'prog'

/** Was ein Tipp im Verlauf öffnet; 'empty' = Tag ohne Eintrag (id = Datum) */
export type DayItem = { kind: 'session' | 'activity' | 'empty'; id: string }

/** Verlauf: Monat mit Kalender und allen Einheiten als Feed, daneben Fortschritt pro Übung */
export function HistoryView({ t, openActivity, openDay }: { t: Training; openActivity: (date: string) => void; openDay: (d: DayItem) => void }) {
  const [sub, setSub] = useState<Sub>('cal')
  const [month, setMonth] = useState(t.today.slice(0, 7))
  return (
    <section className="history">
      <span className="h-date">{sub === 'cal' ? tn('history.totalSessions', t.sessions.filter(L.isTrained).length) : tr('history.perExercise')}</span>
      <h2 className="page-title display">{tr('history.title')}</h2>
      <div className="seg pill" role="group" aria-label={tr('history.view')}>
        {([['cal', tr('history.month')], ['prog', tr('history.progress')]] as const).map(([k, l]) => (
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
  const stats = useMemo(() => L.monthStats(t.sessions, t.activities, month), [t.sessions, t.activities, month, getLocale()])
  const hours = Math.floor(stats.durationSec / 3600), mins = Math.round((stats.durationSec % 3600) / 60)
  // Feed: Einheiten und Cardio des Monats, neueste zuerst
  const feed = useMemo(() => [
    ...t.sessions.filter(s => s.date.startsWith(month) && L.isTrained(s)).map(s => ({ kind: 'session' as const, id: s.id, date: s.date, s })),
    ...t.activities.filter(a => a.date.startsWith(month)).map(a => ({ kind: 'activity' as const, id: a.id, date: a.date, a })),
  ].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.kind === 'session' ? -1 : 1)), [t.sessions, t.activities, month])
  const pickDay = (d: string) => {
    const hit = feed.find(f => f.date === d)
    if (hit) openDay({ kind: hit.kind, id: hit.id })
    else openDay({ kind: 'empty', id: d })
  }

  return (
    <>
      <div className="card hv-month">
        <div className="hv-head">
          <span className="display">{L.fmtMonth(month)}</span>
          <div className="hv-nav">
            <button className="btn btn-secondary btn-icon" aria-label={tr('history.prevMonth')} onClick={() => setMonth(L.shiftMonth(month, -1))}><Icon name="left" size={20} /></button>
            <button className="btn btn-secondary btn-icon" aria-label={tr('history.nextMonth')} disabled={month >= t.today.slice(0, 7)} onClick={() => setMonth(L.shiftMonth(month, 1))}><Icon name="right" size={20} /></button>
          </div>
        </div>
        <div className="hv-stats" aria-label={tr('history.balance', { month: L.fmtMonth(month) })}>
          <div><span className="num">{stats.sessions}</span><small>{tn('history.sessionsLabel', stats.sessions)}</small></div>
          <div><span className="num">{hours ? `${hours}:${String(mins).padStart(2, '0')}` : mins}</span><small>{hours ? tr('history.hours') : tn('history.minutes', mins)}</small></div>
          <div><span className="num">{stats.cardio}</span><small>{tr('history.cardio')}</small></div>
        </div>
        <div className="cal-grid hv-cal">
          {tr('history.weekInitials').split(' ').map((w, i) => <span key={i} className="cal-w">{w}</span>)}
          {Array.from({ length: grid.lead }, (_, i) => <span key={`l${i}`} />)}
          {grid.days.map(d => {
            const cls = ['hv-day', marks.trained.has(d) && 'trained', marks.cardio.has(d) && 'cardio', d === t.today && 'today', d > t.today && 'future'].filter(Boolean).join(' ')
            const label = [L.fmtDate(d), marks.trained.has(d) && tr('history.training'), marks.cardio.has(d) && tr('history.cardio')].filter(Boolean).join(', ')
            return <button key={d} className={cls} aria-label={label} disabled={d > t.today} onClick={() => pickDay(d)}><span className="num">{Number(d.slice(8))}</span></button>
          })}
        </div>
      </div>

      {feed.length === 0 && (
        <p className="empty">{tr('history.emptyMonth', { month: L.fmtMonth(month) })}<br />{tr('history.emptyMonthHint')}</p>
      )}
      <ol className="hv-feed">
        {feed.map(f => {
          const day = new Date(`${f.date}T12:00`)
          const date = (
            <span className="hv-date" aria-hidden="true">
              <small>{day.toLocaleDateString(intl(), { weekday: 'short' }).replace('.', '')}</small>
              <span className="num">{day.getDate()}</span>
            </span>
          )
          if (f.kind === 'activity') return (
            <li key={f.id}>
              <button className="hv-item cardio" onClick={() => openDay({ kind: 'activity', id: f.id })}>
                {date}
                <span className="hv-main"><b className="display">{L.activityTitle(f.a)}</b><small>{L.fmtActivity(f.a) || tr('history.cardio')}</small></span>
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
                  <small>{[w?.name, f.s.durationSec ? L.fmtDuration(f.s.durationSec) : null, tn('history.sets', f.s.sets.length), reps ? tr('history.reps', { n: reps }) : null].filter(Boolean).join(' · ')}</small>
                </span>
                {f.s.note && <Icon name="note" size={16} className="hv-noteicon" />}
                <Icon name="right" size={18} />
              </button>
            </li>
          )
        })}
      </ol>
      <button className="btn btn-ghost btn-block" onClick={() => openActivity(month === t.today.slice(0, 7) ? t.today : `${month}-01`)}><Icon name="plus" size={18} /> {tr('history.addCardio')}</button>
    </>
  )
}

/** Tag im Verlauf als Sheet: alle Sätze und Notizen, unten Löschen */
export function DaySheet({ t, item, onClose, openActivity }: { t: Training; item: DayItem; onClose: () => void; openActivity: (date: string) => void }) {
  if (item.kind === 'empty') return <EmptyDay date={item.id} onClose={onClose} openActivity={openActivity} />
  if (item.kind === 'activity') return <ActivityDetail t={t} id={item.id} onClose={onClose} />
  const s = t.sessions.find(x => x.id === item.id)
  if (!s) return null
  return <SessionDetail t={t} s={s} onClose={onClose} />
}

/** Tag ohne Eintrag: zeigen statt gleich ein Formular zu öffnen – Cardio nachtragen ist eine Option */
function EmptyDay({ date, onClose, openActivity }: { date: string; onClose: () => void; openActivity: (date: string) => void }) {
  const native = useNativeShell()
  // nativ erst nach dem Wegfahren öffnen – iOS präsentiert kein Sheet, solange das alte noch schließt
  const add = () => { onClose(); setTimeout(() => openActivity(date), native ? 450 : 0) }
  useNativeSheet(native ? {
    id: 'empty-day', title: L.fmtDate(date), detents: ['auto'],
    blocks: [{ type: 'text', style: 'muted', text: tr('history.emptyDay') }],
    footer: [{ id: 'cardio', title: tr('history.addCardio'), symbol: 'figure.run' }],
  } : null, e => { if (e.type === 'dismiss') onClose(); else if (e.id === 'cardio') add() })
  if (native) return null
  return (
    <Sheet title={L.fmtDate(date)} onClose={onClose}>
      <p className="hv-sheet-meta">{tr('history.emptyDay')}</p>
      <button className="btn btn-secondary btn-block" onClick={add}><Icon name="plus" size={18} /> {tr('history.addCardio')}</button>
    </Sheet>
  )
}

function ActivityDetail({ t, id, onClose }: { t: Training; id: string; onClose: () => void }) {
  const a = t.activities.find(x => x.id === id)
  const native = useNativeShell()
  const remove = async () => {
    if (a && await ask({ title: tr('history.deleteActivityTitle', { name: L.activityTitle(a) }), message: tr('history.deleteActivityMessage', { date: L.fmtDate(a.date) }), ok: tr('history.delete'), destructive: true })) { t.removeActivity(a.id); onClose() }
  }
  useNativeSheet(native && a ? {
    id: 'activity-day', title: L.activityTitle(a), subtitle: L.fmtDate(a.date), detents: ['auto'],
    blocks: [
      ...(L.fmtActivity(a) ? [{ type: 'text', text: L.fmtActivity(a) } as NBlock] : []),
      ...(a.note ? [{ type: 'text', style: 'note', text: a.note } as NBlock] : []),
    ],
    footer: [{ id: 'delete', title: tr('history.deleteActivity'), symbol: 'trash', style: 'destructive' }],
  } : null, e => { if (e.type === 'dismiss') onClose(); else if (e.type === 'tap' && e.id === 'delete') void remove() })
  if (!a || native) return null
  {
    return (
      <Sheet title={L.activityTitle(a)} sub={L.fmtDate(a.date)} onClose={onClose}>
        {L.fmtActivity(a) && <p className="hv-sheet-meta">{L.fmtActivity(a)}</p>}
        {a.note && <p className="note-text"><Icon name="note" size={14} /><span>{a.note}</span></p>}
        <button className="btn btn-danger btn-block hv-delete" onClick={() => void remove()}><Icon name="trash" size={18} /> {tr('history.deleteActivity')}</button>
      </Sheet>
    )
  }
}

/** Eine Einheit mit allem: Kennzahlen, Bestwerte, jede Übung mit Stufe, Sätzen, Notizen und Vergleich */
function SessionDetail({ t, s, onClose }: { t: Training; s: Session; onClose: () => void }) {
  const w = t.ix.workouts.get(s.workout)
  const sum = useMemo(() => L.sessionSummary(t.ix, t.sessions, s), [t.ix, t.sessions, s, getLocale()])
  const rows = L.sessionExercises(t.ix, s)
  const running = !!t.active && L.sessionId(L.localDate(new Date(t.active.start)), t.active.workout) === s.id
  const h = Math.floor(sum.durationSec / 3600), m = Math.round((sum.durationSec % 3600) / 60)
  const stepOf = (x: SetLog) => {
    const p = t.ix.progressions.get(x.progression)
    const i = p?.steps.findIndex(st => st.exercise === x.exercise) ?? -1
    return p && p.steps.length > 1 && i >= 0 ? tr('logic.stage', { i: i + 1, n: p.steps.length }) : null
  }
  const routine = (items: RoutineItem[]) => items.filter(it => !it.cardio).length
    ? `${items.filter(it => !it.cardio && s.routineDone.includes(it.id)).length}/${items.filter(it => !it.cardio).length}` : null
  const warm = w ? routine(w.warmup) : null, cool = w ? routine(w.cooldown) : null
  const skipped = s.skipped.map(id => t.ix.exercises.get(id)?.name).filter(Boolean)
  const remove = async () => {
    const what = tn('history.deleteSessionWhat', s.sets.length, { workout: w?.name ?? tr('history.sessionFallback'), date: L.fmtDate(s.date) })
    if (await ask({ title: tr('history.deleteSessionTitle'), message: `${what}${running ? tr('history.deleteSessionRunning') : ''}${tr('history.deleteSessionFinal')}`, ok: tr('history.delete'), destructive: true })) { t.removeSession(s.id); onClose() }
  }
  const native = useNativeShell()
  const minutes = sum.durationSec ? (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) : '–'
  useNativeSheet(native ? {
    id: 'session-day', title: w ? w.focus : s.workout, subtitle: `${L.fmtDate(s.date)}${w ? ` · ${w.name}` : ''}`, detents: ['large', 'medium'],
    blocks: [
      { type: 'stats', items: [
        { value: minutes, label: h ? tr('history.hours') : tn('history.minutes', m) },
        { value: String(sum.sets), label: tn('history.setsLabel', sum.sets) },
        { value: String(sum.reps), label: tr('history.repsLabel'), delta: sum.repsDelta ? `${sum.repsDelta > 0 ? '+' : '−'}${Math.abs(sum.repsDelta)}` : undefined },
      ] },
      ...(s.note ? [{ type: 'text', style: 'note', text: s.note } as NBlock] : []),
      ...(sum.records.length ? [{ type: 'section', title: tr('history.records') } as NBlock] : []),
      ...sum.records.map((r): NBlock => ({
        type: 'record', title: r.exercise.name, value: r.kind === 'weight' ? `+${r.value}` : String(r.value),
        subtitle: r.kind === 'weight' ? (r.before ? tr('history.recordWeight', { value: r.value, before: r.before }) : tr('history.recordWeightFirst', { value: r.value }))
          : tr('history.recordBest', { value: r.value, unit: r.exercise.unit === 'seconds' ? ' s' : '', before: String(r.before) }),
      })),
      ...(rows.length ? [{ type: 'section', title: tr('history.exercises') } as NBlock] : [{ type: 'text', style: 'muted', text: tr('history.noSets', { extra: sum.durationSec ? tr('history.noSetsTimeOnly') : '' }) } as NBlock]),
      ...rows.map((r): NBlock => {
        const c = sum.compare.find(x => x.exercise.id === r.exercise.id)
        const d = c ? c.now - c.before : null
        const unit = r.exercise.unit === 'seconds' ? 's' : ''
        const notes = L.notesOf(r.sets).map(n => tr('history.setNote', { n: n.set, note: n.note }))
        return {
          type: 'row', symbol: 'none', title: r.exercise.name,
          subtitle: [stepOf(r.sets[0]), ...notes].filter(Boolean).join('\n') || undefined,
          chips: r.sets.map(x => `${x.value}${unit}${x.weightKg ? ` +${x.weightKg}` : ''}`),
          delta: d !== null ? `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}` : undefined,
        }
      }),
      ...(warm || cool || skipped.length ? [{ type: 'text', style: 'muted', text: [warm && tr('history.warmup', { n: warm }), cool && tr('history.cooldown', { n: cool }), skipped.length ? tr('history.skipped', { list: skipped.join(', ') }) : null].filter(Boolean).join(' · ') } as NBlock] : []),
    ],
    footer: [{ id: 'delete', title: tr('history.deleteSession'), symbol: 'trash', style: 'destructive' }],
  } : null, e => { if (e.type === 'dismiss') onClose(); else if (e.type === 'tap' && e.id === 'delete') void remove() })
  if (native) return null

  return (
    <Sheet large title={w ? w.focus : s.workout} sub={`${L.fmtDate(s.date)}${w ? ` · ${w.name}` : ''}`} onClose={onClose}
      footer={
        <button className="btn btn-danger btn-block" onClick={() => void remove()}><Icon name="trash" size={18} /> {tr('history.deleteSession')}</button>
      }>
      <div className="sm-stats sd-stats">
        <div><span className="num">{sum.durationSec ? (h ? `${h}:${String(m).padStart(2, '0')}` : m) : '–'}</span><small>{h ? tr('history.hours') : tn('history.minutes', m)}</small></div>
        <div><span className="num">{sum.sets}</span><small>{tr('history.setsLabel.other')}</small></div>
        <div><span className="num">{sum.reps}</span><small>{tr('history.repsLabel')}{sum.repsDelta ? <> · <b className={sum.repsDelta > 0 ? 'up' : ''}>{sum.repsDelta > 0 ? '+' : '−'}{Math.abs(sum.repsDelta)}</b></> : ''}</small></div>
      </div>
      {s.note && <p className="note-text sd-note"><Icon name="note" size={14} /><span>{s.note}</span></p>}

      {sum.records.length > 0 && (
        <section className="sm-block">
          <h3 className="display">{tr('history.records')}</h3>
          {sum.records.map(r => (
            <div key={`${r.exercise.id}-${r.kind}`} className="sm-record">
              <span className="sm-badge"><Icon name="trophy" size={20} /></span>
              <span className="sm-record-text">
                <b>{r.exercise.name}</b>
                <small>{r.kind === 'weight'
                  ? (r.before ? tr('history.recordWeight', { value: r.value, before: r.before }) : tr('history.recordWeightFirst', { value: r.value }))
                  : tr('history.recordBest', { value: r.value, unit: r.exercise.unit === 'seconds' ? ' s' : '', before: String(r.before) })}</small>
              </span>
              <span className="num sm-record-value">{r.kind === 'weight' ? `+${r.value}` : r.value}</span>
            </div>
          ))}
        </section>
      )}

      {rows.length > 0 && <section className="sm-block">
        <h3 className="display">{tr('history.exercises')}</h3>
        <ul className="sd-ex">
          {rows.map(r => {
            const c = sum.compare.find(x => x.exercise.id === r.exercise.id)
            const d = c ? c.now - c.before : null
            const step = stepOf(r.sets[0])
            const unit = r.exercise.unit === 'seconds' ? 's' : ''
            return (
              <li key={r.exercise.id} className="sd-row">
                <div className="sd-row-head">
                  <span className="sd-name"><b>{r.exercise.name}</b>{step && <small>{step}</small>}</span>
                  {d !== null && <span className={`num sm-delta${d > 0 ? ' up' : ''}`} title={tr('history.sinceLast')}>{d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)}</span>}
                </div>
                <span className="day-sets sd-sets">
                  {r.sets.map((x, i) => (
                    <span key={i} className={`num day-set${x.note ? ' has-note' : ''}`}>
                      {x.value}{unit ? <small>{unit}</small> : null}{x.weightKg ? <small>+{x.weightKg}</small> : null}
                    </span>
                  ))}
                </span>
                {L.notesOf(r.sets).map(n => <span key={n.set} className="set-note"><Icon name="note" size={12} /> {tr('history.setNote', { n: n.set, note: n.note })}</span>)}
              </li>
            )
          })}
        </ul>
      </section>}
      {rows.length === 0 && <p className="empty">{tr('history.noSets', { extra: sum.durationSec ? tr('history.noSetsTimeOnly') : '' })}</p>}

      {(skipped.length > 0 || warm || cool) && (
        <ul className="f-facts sd-more">
          {warm && <li>{tr('history.warmup', { n: warm })}</li>}
          {cool && <li>{tr('history.cooldown', { n: cool })}</li>}
          {skipped.length > 0 && <li className="muted">{tr('history.skipped', { list: skipped.join(', ') })}</li>}
        </ul>
      )}
    </Sheet>
  )
}

/* ── Fortschritt ── */

function Progress({ t }: { t: Training }) {
  const groups = useMemo(() => L.progressOverview(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, getLocale()])
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length) return <p className="empty">{tr('history.noData')}<br />{tr('history.noDataHint')}</p>
  return (
    <>
      <p className="pg-key">
        <span>{tr('history.keyBars')}</span>
        <span><i className="k-last" /> {tr('history.keyLast')}</span>
        <span><i className="k-step" /> {tr('history.keyStep')}</span>
        <span>{tr('history.keyTap')}</span>
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
  const unit = ex.unit === 'seconds' ? 's' : tr('history.repsLabel')
  const delta = !p.last ? tr('history.newStep')
    : p.delta === null ? (p.step.index > 0 ? tr('history.firstOnStep') : tr('history.first'))
    : tr('history.deltaSince', { delta: `${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '± '}${Math.abs(p.delta)}`, date: L.fmtShortDate(p.prev!.date) })
  const meta = [
    p.step.total > 1 ? tr('logic.stage', { i: p.step.index + 1, n: p.step.total }) : null,
    tn('history.sessionCount', p.current.length),
    p.best !== null ? tr('history.bestSet', { value: p.best, unit: ex.unit === 'seconds' ? ' s' : '' }) : null,
    p.weightKg ? tr('history.upToWeight', { kg: p.weightKg }) : null,
    p.paused ? tr('history.paused') : p.ready ? tr('history.readyFor', { name: p.step.next!.name }) : null,
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
          <thead><tr><th>{tr('history.colDate')}</th><th>{tr('history.colStep')}</th><th>{tr('history.colSets')}</th><th>Σ</th></tr></thead>
          <tbody>
            {p.history.slice(-12).reverse().map((h, i) => (
              <tr key={`${h.date}-${h.step}-${i}`}>
                <td>{L.fmtShortDate(h.date)}</td><td>{h.step + 1}</td>
                <td>
                  {h.sets.map(x => `${x.value}${x.weightKg ? `+${x.weightKg}kg` : ''}${x.note ? '*' : ''}`).join(' · ')}
                  {L.notesOf(h.sets).map(n => <span key={n.set} className="set-note">{tr('history.setNote', { n: n.set, note: n.note })}</span>)}
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
      aria-label={tr('history.sparkLabel', { n: pts.length, values: pts.map(p => p.sum).join(', ') })}>
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
