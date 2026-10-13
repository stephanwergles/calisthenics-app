'use client'
/* Tab „Plan“: die Woche (Tag → Workout) und alle eigenen Workouts. Bearbeitet wird in Sheets
   (PlanEditor.tsx); Phasen und Planvorschläge kommen hier später dazu. */
import { useMemo, useState } from 'react'
import type { Weekday, WorkoutId } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { DAY_NAME, DayAssign, WorkoutsHost } from './PlanEditor'
import { Icon } from './Icon'

const count = (n: number) => `${n} ${n === 1 ? 'Übung' : 'Übungen'}`

export function PlanView({ t }: { t: Training }) {
  const [edit, setEdit] = useState<{ id?: WorkoutId; startNew?: boolean } | null>(null)
  const [day, setDay] = useState<Weekday | null>(null)
  const today = L.weekdayOf(t.today)
  const list = L.workoutsInWeekOrder(t.ix)
  const week = L.WEEK_ORDER.map(d => ({ d, w: t.ix.catalog.weekplan[d] ? t.ix.workouts.get(t.ix.catalog.weekplan[d]!) : undefined }))
  const days = week.filter(x => x.w).length
  const minutes = useMemo(() => {
    const m = week.flatMap(x => (x.w ? [L.estimateMinutes(t.sessions, x.w.id)] : [])).filter((x): x is number => !!x)
    return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length / 5) * 5 : null
  }, [week, t.sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="plan">
      <span className="h-date">{t.plan ? 'Mein Plan' : 'Standardplan'} · {days} {days === 1 ? 'Tag' : 'Tage'}{minutes ? ` · ca. ${minutes} min` : ''}</span>
      <h2 className="page-title display">Plan</h2>

      <h3 className="pl-head display">Woche</h3>
      <ol className="pl-week card">
        {week.map(({ d, w }) => (
          <li key={d}>
            <button className={`pl-day${d === today ? ' today' : ''}`} onClick={() => (w ? setEdit({ id: w.id }) : setDay(d))}
              aria-label={`${DAY_NAME[d]}: ${w ? w.name : 'Ruhetag'}${d === today ? ', heute' : ''}`}>
              <span className="pl-wd">{L.WEEKDAY_SHORT[d]}</span>
              <span className="pl-main">
                <b className={w ? '' : 'off'}>{w ? `${w.name} · ${w.focus}` : 'Ruhetag'}</b>
                {w && <small>{count(w.slots.length)}</small>}
              </span>
              {d === today && <span className="pl-tag">heute</span>}
              <Icon name="right" size={16} className="pl-chev" />
            </button>
          </li>
        ))}
      </ol>

      <div className="pl-head-row">
        <h3 className="pl-head display">Meine Workouts</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ startNew: true })}><Icon name="plus" size={16} /> Neu</button>
      </div>
      <div className="pl-grid">
        {list.map(w => (
          <button key={w.id} className="pl-card" onClick={() => setEdit({ id: w.id })}>
            <b className="display">{w.name}</b>
            <small>{w.focus} · {count(w.slots.length)}</small>
            <em>{L.plannedDays(t.ix, w.id).map(x => L.WEEKDAY_SHORT[x]).join(' · ') || 'kein Tag'}</em>
          </button>
        ))}
      </div>
      {!t.plan && <p className="hint pl-note">Das ist noch der Standardplan. Deine erste Änderung macht ihn zu deinem – danach gleicht er sich über dein Konto ab.</p>}

      {edit && <WorkoutsHost t={t} list={false} initial={edit.id} startNew={edit.startNew} onClose={() => setEdit(null)} />}
      {day && <DayAssign t={t} day={day} onClose={() => setDay(null)} />}
    </section>
  )
}
