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
import { t as tr, tn } from '../i18n'
import { toast } from '../toast'

const count = (n: number) => tn('plan.exercises', n)

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
      <span className="h-date">{t.plan ? tr('plan.view.myPlan') : tr('plan.view.defaultPlan')} · {tn('plan.view.days', days)}{minutes ? tr('plan.view.minutes', { n: minutes }) : ''}</span>
      <h2 className="page-title display">{tr('plan.view.title')}</h2>

      {ps.suggestion ? (
        <button className="pl-suggest" onClick={() => setViewing(true)}>
          <span className="h-date">{tr('plan.view.suggestLabel')}</span>
          <b className="display">{tr('plan.view.suggestTitle')}</b>
          <small>{tn('plan.view.suggestChanges', ps.suggestion.changes)}</small>
          <em>{tr('plan.view.view')} <Icon name="right" size={14} /></em>
        </button>
      ) : !ps.hasGoals ? (
        <button className="pl-suggest quiet" onClick={() => setGoals(true)}>
          <b className="display">{tr('plan.view.goalsTitle')}</b>
          <small>{tr('plan.view.goalsSub')}</small>
        </button>
      ) : ps.hidden ? (
        <button className="btn btn-ghost btn-sm pl-hidden" onClick={() => { ps.show(); setViewing(true) }}>{tr('plan.view.showHidden')}</button>
      ) : null}
      {ps.canUndo && (
        <button className="btn btn-ghost btn-sm pl-hidden" onClick={async () => {
          if (await ask({ title: tr('plan.view.undoTitle'), message: tr('plan.view.undoMessage'), ok: tr('plan.view.undoOk') })) ps.undo()
        }}><Icon name="undo" size={16} /> {tr('plan.view.undo')}</button>
      )}

      <button className="pl-suggest quiet pl-library" onClick={() => setLibrary(true)}>
        <b className="display">{tr('plan.view.templates')}</b>
        <small>{tr('plan.view.templatesSub')}</small>
        <em>{tr('plan.view.view')} <Icon name="right" size={14} /></em>
      </button>

      <h3 className="pl-head display">{tr('plan.view.week')}</h3>
      <ol className="pl-week card">
        {week.map(({ d, w }) => (
          <li key={d}>
            <button className={`pl-day${d === today ? ' today' : ''}`} onClick={() => (w ? setEdit({ id: w.id }) : setDay(d))}
              aria-label={`${DAY_NAME[d]}: ${w ? w.name : tr('plan.restDay')}${d === today ? tr('plan.view.todaySuffix') : ''}`}>
              <span className="pl-wd">{L.WEEKDAY_SHORT[d]}</span>
              <span className="pl-main">
                <b className={w ? '' : 'off'}>{w ? w.name : tr('plan.restDay')}</b>
                {w && <small>{w.focus && w.focus !== w.name ? `${w.focus} · ` : ''}{count(w.slots.length)}</small>}
              </span>
              {d === today && <span className="pl-tag">{tr('plan.view.today')}</span>}
              <Icon name="right" size={16} className="pl-chev" />
            </button>
          </li>
        ))}
      </ol>

      <div className="pl-head-row">
        <h3 className="pl-head display">{tr('plan.view.myWorkouts')}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ startNew: true })}><Icon name="plus" size={16} /> {tr('plan.view.new')}</button>
      </div>
      <div className="pl-grid">
        {list.map(w => (
          <button key={w.id} className="pl-card" onClick={() => setEdit({ id: w.id })}>
            <b className="display">{w.name}</b>
            <small>{w.focus} · {count(w.slots.length)}</small>
            <em>{L.plannedDays(t.ix, w.id).map(x => L.WEEKDAY_SHORT[x]).join(' · ') || tr('plan.view.noDay')}</em>
          </button>
        ))}
      </div>
      <h3 className="pl-head display">{tr('plan.view.phases')}</h3>
      {[...active, ...upcoming].map(p => (
        <div key={p.id} className="card pl-phase">
          <span><b>{L.fmtPhase(p)}</b><small>{tr('plan.view.since', { date: L.fmtShortDate(p.from) })}</small></span>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            if (await ask({ title: tr('plan.view.endTitle', { phase: L.PHASE_LABEL[p.kind] }), message: tr('plan.view.endMessage'), ok: tr('plan.view.end') }))
              { t.setState(st => L.withPhaseEnded(st, p.id, t.today)); toast(tr('common.toast.phaseEnded')) }
          }}>{tr('plan.view.end')}</button>
        </div>
      ))}
      {!active.length && <p className="hint pl-note pl-phase-hint">{tr('plan.view.phaseHint')}</p>}
      <div className="pl-phase-btns">
        {(Object.keys(L.PHASE_LABEL) as PhaseKind[]).filter(k => !active.some(p => p.kind === k)).map(k => (
          <button key={k} className="btn btn-secondary" onClick={() => setPhase(k)}>{L.PHASE_LABEL[k]}</button>
        ))}
      </div>

      {!t.plan && <p className="hint pl-note">{tr('plan.view.defaultHint')}</p>}

      {edit && <WorkoutsHost t={t} list={false} initial={edit.id} startNew={edit.startNew} onClose={() => setEdit(null)} />}
      {day && <DayAssign t={t} day={day} onClose={() => setDay(null)} />}
      {viewing && shown && <SuggestionSheet t={t} s={shown} ps={ps} onClose={() => setViewing(false)} />}
      {goals && <GoalPicker t={t} onClose={() => setGoals(false)} />}
      {phase && <PhaseSheet t={t} kind={phase} onClose={() => setPhase(null)} />}
      {library && <TemplatesSheet t={t} ps={ps} onClose={() => setLibrary(false)} />}
    </section>
  )
}
