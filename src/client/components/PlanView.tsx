'use client'
/* Tab „Plan“: Planvorschlag (wartet auf Bestätigung), die Woche (Tag → Workout) und alle
   eigenen Workouts. Bearbeitet wird in Sheets (PlanEditor.tsx, SuggestionSheet.tsx). */
import { useMemo, useState } from 'react'
import type { Weekday, WorkoutId } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { DAY_NAME, DayAssign, WorkoutsHost } from './PlanEditor'
import { Icon } from './Icon'
import type { PlanSuggestion } from '../usePlanSuggestion'
import { SuggestionSheet } from './SuggestionSheet'
import { GoalPicker } from './ProfileParts'
import { ask } from '../native'
import { PhaseSheet } from './PhaseSheet'
import { TemplatesSheet } from './TemplatesSheet'
import type { PhaseKind } from '@/domain/model'

const count = (n: number) => `${n} ${n === 1 ? 'Übung' : 'Übungen'}`

export function PlanView({ t, ps }: { t: Training; ps: PlanSuggestion }) {
  const [edit, setEdit] = useState<{ id?: WorkoutId; startNew?: boolean } | null>(null)
  const [viewing, setViewing] = useState(false)
  const [goals, setGoals] = useState(false)
  const [phase, setPhase] = useState<PhaseKind | null>(null)
  const [library, setLibrary] = useState(false)
  const active = L.activePhases(t.state, t.today)
  const upcoming = (t.state.phases ?? []).filter(p => p.from > t.today)
  const shown = ps.suggestion ?? (viewing ? ps.hidden : null)
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

      {ps.suggestion ? (
        <button className="pl-suggest" onClick={() => setViewing(true)}>
          <span className="h-date">Vorschlag · wartet auf dich</span>
          <b className="display">Plan für deine Ziele</b>
          <small>{ps.suggestion.changes} {ps.suggestion.changes === 1 ? 'Änderung' : 'Änderungen'} · erst nach deiner Bestätigung</small>
          <em>Ansehen <Icon name="right" size={14} /></em>
        </button>
      ) : !ps.hasGoals ? (
        <button className="pl-suggest quiet" onClick={() => setGoals(true)}>
          <b className="display">Ziele wählen</b>
          <small>Dann schlägt Lever einen Plan dafür vor – du entscheidest, ob er gilt.</small>
        </button>
      ) : ps.hidden ? (
        <button className="btn btn-ghost btn-sm pl-hidden" onClick={() => { ps.show(); setViewing(true) }}>Ausgeblendeten Vorschlag ansehen</button>
      ) : null}
      {ps.canUndo && (
        <button className="btn btn-ghost btn-sm pl-hidden" onClick={async () => {
          if (await ask({ title: 'Vorherigen Plan wiederherstellen?', message: 'Der zuletzt übernommene Vorschlag wird zurückgenommen. Deine Einheiten bleiben, wie sie sind.', ok: 'Wiederherstellen' })) ps.undo()
        }}><Icon name="undo" size={16} /> Letzten Vorschlag rückgängig</button>
      )}

      <button className="pl-suggest quiet pl-library" onClick={() => setLibrary(true)}>
        <b className="display">Vorlagen</b>
        <small>Fertige Pläne und Workouts – Einsteiger, Zuhause, Muscle-up, Core-Finisher …</small>
        <em>Ansehen <Icon name="right" size={14} /></em>
      </button>

      <h3 className="pl-head display">Woche</h3>
      <ol className="pl-week card">
        {week.map(({ d, w }) => (
          <li key={d}>
            <button className={`pl-day${d === today ? ' today' : ''}`} onClick={() => (w ? setEdit({ id: w.id }) : setDay(d))}
              aria-label={`${DAY_NAME[d]}: ${w ? w.name : 'Ruhetag'}${d === today ? ', heute' : ''}`}>
              <span className="pl-wd">{L.WEEKDAY_SHORT[d]}</span>
              <span className="pl-main">
                <b className={w ? '' : 'off'}>{w ? w.name : 'Ruhetag'}</b>
                {w && <small>{w.focus && w.focus !== w.name ? `${w.focus} · ` : ''}{count(w.slots.length)}</small>}
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
      <h3 className="pl-head display">Phasen</h3>
      {[...active, ...upcoming].map(p => (
        <div key={p.id} className="card pl-phase">
          <span><b>{L.fmtPhase(p)}</b><small>seit {L.fmtShortDate(p.from)}</small></span>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            if (await ask({ title: `${L.PHASE_LABEL[p.kind]} beenden?`, message: 'Ab heute gilt wieder dein normaler Plan.', ok: 'Beenden' }))
              t.setState(st => L.withPhaseEnded(st, p.id, t.today))
          }}>Beenden</button>
        </div>
      ))}
      {!active.length && <p className="hint pl-note pl-phase-hint">Bei Pause, Urlaub oder Verletzung passt Lever an, was fällig ist – deine Serie bleibt.</p>}
      <div className="pl-phase-btns">
        {(Object.keys(L.PHASE_LABEL) as PhaseKind[]).filter(k => !active.some(p => p.kind === k)).map(k => (
          <button key={k} className="btn btn-secondary" onClick={() => setPhase(k)}>{L.PHASE_LABEL[k]}</button>
        ))}
      </div>

      {!t.plan && <p className="hint pl-note">Das ist noch der Standardplan. Deine erste Änderung macht ihn zu deinem – danach gleicht er sich über dein Konto ab.</p>}

      {edit && <WorkoutsHost t={t} list={false} initial={edit.id} startNew={edit.startNew} onClose={() => setEdit(null)} />}
      {day && <DayAssign t={t} day={day} onClose={() => setDay(null)} />}
      {viewing && shown && <SuggestionSheet t={t} s={shown} ps={ps} onClose={() => setViewing(false)} />}
      {goals && <GoalPicker t={t} onClose={() => setGoals(false)} />}
      {phase && <PhaseSheet t={t} kind={phase} onClose={() => setPhase(null)} />}
      {library && <TemplatesSheet t={t} ps={ps} onClose={() => setLibrary(false)} />}
    </section>
  )
}
