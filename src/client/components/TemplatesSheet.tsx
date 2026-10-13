'use client'
/* Bibliothek: Plan- und Workout-Vorlagen (Plan-Tab → Vorlagen). Liste als Sheet, jede Vorlage als
   Push-Seite. Plan übernehmen = neue Planversion nach Rückfrage (rückgängig im Plan-Tab),
   Workout = Kopie unter „Meine Workouts“, auf Wunsch gleich für heute. */
import { useState } from 'react'
import type { Template } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { PlanSuggestion } from '../usePlanSuggestion'
import { ask, type NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { catalogData } from '../data'
import { DAY_NAME } from './PlanEditor'
import { Icon } from './Icon'
import { Sheet } from './Sheets'

const meta = (tp: Template) => [L.LEVEL_LABEL[tp.level], tp.days ? `${tp.days}× pro Woche` : null, `ca. ${tp.minutes} min`]
  .filter(Boolean).join(' · ')
const gear = (tp: Template) => tp.equipment.length
  ? tp.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL] ?? e).join(', ') : 'nur Boden und Wand'

export function TemplatesSheet({ t, ps, onClose, parent, plansOnly, onDone }: {
  t: Training; ps: PlanSuggestion; onClose: () => void
  /** Onboarding: als Push-Seite, nur Pläne, nach dem Übernehmen onDone */
  parent?: { id: string; title: string }; plansOnly?: boolean; onDone?: () => void
}) {
  const native = useNativeShell()
  const [kind, setKind] = useState<'plan' | 'workout'>('plan')
  const [open, setOpen] = useState<string | null>(null)
  const all = catalogData(t.ix.catalog).templates
  const list = all.filter(x => x.kind === kind)
  const tpl = all.find(x => x.id === open)
  const sub = 'Fertige Pläne und Workouts – sie starten auf deiner aktuellen Stufe jeder Progression.'
  useNativeSheet(native ? {
    id: 'templates', parent: parent?.id, title: plansOnly ? 'Plan-Vorlagen' : 'Vorlagen', subtitle: sub, detents: ['large'],
    blocks: [
      ...(plansOnly ? [] : [{ type: 'segmented', id: 'kind', options: [{ id: 'plan', title: 'Pläne' }, { id: 'workout', title: 'Workouts' }], selected: kind } as NBlock]),
      ...list.map((x): NBlock => ({ type: 'row', id: `tpl:${x.id}`, title: x.name, subtitle: meta(x), symbol: 'none' })),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('kind:')) setKind(e.id.slice(5) as 'plan' | 'workout')
    else if (e.type === 'tap' && e.id?.startsWith('tpl:')) setOpen(e.id.slice(4))
    else if (e.type === 'dismiss') onClose()
  })
  const detail = tpl && <TemplatePage t={t} ps={ps} tpl={tpl} onBack={() => setOpen(null)} onDone={onDone ?? onClose} />
  if (native) return detail ?? null
  return (
    <>
      <Sheet large title={plansOnly ? 'Plan-Vorlagen' : 'Vorlagen'} sub={sub} back={parent?.title} onClose={onClose}>
        {!plansOnly && <div className="seg pill" role="group" aria-label="Art">
          {(['plan', 'workout'] as const).map(k => <button key={k} className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'plan' ? 'Pläne' : 'Workouts'}</button>)}
        </div>}
        <div className="tp-list">
          {list.map(x => (
            <button key={x.id} className="pl-card tp-card" onClick={() => setOpen(x.id)}>
              <b className="display">{x.name}</b>
              <small>{x.description}</small>
              <em>{meta(x)}</em>
            </button>
          ))}
        </div>
      </Sheet>
      {detail}
    </>
  )
}

function TemplatePage({ t, ps, tpl, onBack, onDone }: { t: Training; ps: PlanSuggestion; tpl: Template; onBack: () => void; onDone: () => void }) {
  const native = useNativeShell()
  const [added, setAdded] = useState<string | null>(null)
  const profileDays = L.profileOf(t.ix, t.state).days
  const plan = tpl.kind === 'plan' ? L.planFromTemplate(t.ix, t.plan ?? L.planFromCatalog(t.baseCatalog), tpl, profileDays) : null
  const changes = plan ? L.planDiff(t.ix, t.state, plan).reduce((n, d) => n + d.changes.filter(c => c.kind !== 'bleibt').length, 0) : 0
  const dayOf = (wid: string) => plan ? L.WEEK_ORDER.filter(d => plan.weekplan[d] === `${tpl.id}-${wid}`).map(d => DAY_NAME[d]).join(', ') : ''
  const exercises = (w: Template['workouts'][number]) => w.slots.filter(s => t.ix.progressions.has(s.progression)).map(s => {
    const step = L.currentStep(t.ix, t.state, s.progression)
    return { pid: s.progression, name: step.exercise.name, sets: s.sets ?? step.target.sets, label: step.target.label }
  })
  const applyPlan = async () => {
    if (!plan) return
    if (!await ask({ title: `„${tpl.name}“ übernehmen?`, message: `${changes} Änderungen an deiner Woche. Deine Einheiten bleiben im Verlauf; im Plan-Tab lässt sich das rückgängig machen.`, ok: 'Übernehmen' })) return
    ps.apply(plan); onDone()
  }
  const addWorkout = (today: boolean) => {
    const w = L.workoutFromTemplate(t.ix, tpl)
    t.editPlan(p => L.withWorkout(p, w))
    if (today) { t.chooseWorkout(w.id); onDone() } else setAdded(w.name)
  }
  const sub = `${meta(tpl)} · ${gear(tpl)}`
  const footer = tpl.kind === 'plan'
    ? [{ id: 'apply', title: 'Plan übernehmen', symbol: 'checkmark', style: 'prominent' as const }]
    : [{ id: 'today', title: 'Heute trainieren', symbol: 'play.fill', style: 'prominent' as const }, { id: 'add', title: 'Zu meinen Workouts' }]
  useNativeSheet(native ? {
    id: 'template', parent: 'templates', title: tpl.name, subtitle: sub, detents: ['large'], footer,
    blocks: [
      { type: 'text', text: tpl.description, style: 'body' },
      ...(added ? [{ type: 'text', text: `„${added}“ steht jetzt unter Meine Workouts.`, style: 'accent' } as NBlock] : []),
      ...tpl.workouts.flatMap((w): NBlock[] => [
        { type: 'section', title: tpl.kind === 'plan' ? `${w.name}${dayOf(w.id) ? ` · ${dayOf(w.id)}` : ''}` : 'Übungen' },
        ...exercises(w).map((x): NBlock => ({ type: 'row', title: x.name, trailing: `${x.sets} Sätze`, symbol: 'none' })),
      ]),
      ...(plan ? [{ type: 'text', text: `Übernehmen ändert ${changes} Dinge an deiner Woche${profileDays.length === (tpl.days ?? 0) ? ' – auf deinen Trainingstagen' : ''}.`, style: 'small' } as NBlock] : []),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'apply') void applyPlan()
    else if (e.type === 'tap' && e.id === 'today') addWorkout(true)
    else if (e.type === 'tap' && e.id === 'add') addWorkout(false)
    else if (e.type === 'dismiss') onBack()
  })
  if (native) return null
  return (
    <Sheet large title={tpl.name} sub={sub} back="Vorlagen" onClose={onBack}
      footer={tpl.kind === 'plan'
        ? <button className="btn btn-primary btn-block" onClick={() => void applyPlan()}><Icon name="check" size={18} /> Plan übernehmen</button>
        : <div className="sg-foot">
            <button className="btn btn-primary btn-block" onClick={() => addWorkout(true)}><Icon name="play" size={18} /> Heute trainieren</button>
            <button className="btn btn-secondary btn-block" onClick={() => addWorkout(false)}>Zu meinen Workouts</button>
          </div>}>
      <p className="hint">{tpl.description}</p>
      {added && <p className="hint tp-added" role="status">„{added}“ steht jetzt unter Meine Workouts.</p>}
      {tpl.workouts.map(w => (
        <section key={w.id}>
          <h4 className="pe-section">{tpl.kind === 'plan' ? `${w.name}${dayOf(w.id) ? ` · ${dayOf(w.id)}` : ''}` : 'Übungen'}</h4>
          <ul className="tp-ex">{exercises(w).map(x => <li key={x.pid}><span>{x.name}</span><em>{x.sets} Sätze</em></li>)}</ul>
        </section>
      ))}
      {plan && <p className="hint">Übernehmen ändert {changes} Dinge an deiner Woche{profileDays.length === (tpl.days ?? 0) ? ' – auf deinen Trainingstagen' : ''}.</p>}
    </Sheet>
  )
}
