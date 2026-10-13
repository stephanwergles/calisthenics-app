'use client'
/* Planvorschlag ansehen: je Wochentag vorher → nachher, was dazukommt, wegfällt, sich ändert.
   Erst „Übernehmen“ schreibt eine neue Planversion. */
import type { Training } from '../useTraining'
import type { PlanSuggestion, Suggestion } from '../usePlanSuggestion'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { DAY_NAME } from './PlanEditor'
import { catalogData } from '../data'
import { Sheet } from './Sheets'
import * as L from '../logic'
import { t as tr, tn, type Key } from '../i18n'

const KIND: Record<string, Key> = { neu: 'plan.suggestion.kind.new', raus: 'plan.suggestion.kind.out', sätze: 'plan.suggestion.kind.sets' }

export function SuggestionSheet({ t, s, ps, onClose, parent, onDone }: {
  t: Training; s: Suggestion; ps: PlanSuggestion; onClose: () => void
  /** Onboarding: als Push-Seite; onDone nach Übernehmen/Später */
  parent?: { id: string; title: string }; onDone?: () => void
}) {
  const native = useNativeShell()
  const goals = L.profileOf(t.ix, t.state).goals.map(g => catalogData(t.ix.catalog).skills.find(x => x.id === g)?.name ?? g).join(', ')
  const version = (t.plan?.version ?? 0)
  const sub = tn('plan.suggestion.sub', s.changes, { goals })
  const intro = tr('plan.suggestion.intro')
  const head = (d: L.DayDiff) => `${DAY_NAME[d.day]} · ${d.before ?? tr('plan.restDay')} → ${d.after ?? tr('plan.restDay')}`
  const kept = (d: L.DayDiff) => d.changes.filter(c => c.kind === 'bleibt').map(c => c.name)
  const accept = () => { ps.accept(); (onDone ?? onClose)() }
  const later = () => { ps.dismiss(); (onDone ?? onClose)() }

  useNativeSheet(native ? {
    id: 'suggestion', parent: parent?.id, title: tr('plan.suggestion.title'), subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'text', text: intro, style: 'muted' },
      ...s.warnings.map((w): NBlock => ({ type: 'text', text: w, style: 'warn' })),
      ...s.diff.flatMap((d): NBlock[] => [
        { type: 'section', title: head(d) },
        ...d.changes.filter(c => c.kind !== 'bleibt').map((c): NBlock => ({ type: 'row', title: c.name, subtitle: c.detail, trailing: tr(KIND[c.kind]), symbol: 'none' })),
        ...(kept(d).length ? [{ type: 'text', text: tr('plan.suggestion.kept', { names: kept(d).join(', ') }), style: 'small' } as NBlock] : []),
      ]),
    ],
    footer: [{ id: 'accept', title: tr('plan.suggestion.accept', { n: version + 1 }), symbol: 'checkmark', style: 'prominent' }, { id: 'later', title: tr('plan.suggestion.later') }],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'accept') accept()
    else if (e.type === 'tap' && e.id === 'later') later()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={tr('plan.suggestion.title')} sub={sub} back={parent?.title} onClose={onClose}
      footer={<div className="sg-foot">
        <button className="btn btn-primary btn-block" onClick={accept}>{tr('plan.suggestion.accept', { n: version + 1 })}</button>
        <button className="btn btn-secondary btn-block" onClick={later}>{tr('plan.suggestion.later')}</button>
      </div>}>
      <p className="hint">{intro}</p>
      {s.warnings.map(w => <p key={w} className="warn">{w}</p>)}
      {s.diff.map(d => (
        <section key={d.day} className="sg-day">
          <h4 className="pe-section">{head(d)}</h4>
          <ul>
            {d.changes.filter(c => c.kind !== 'bleibt').map(c => (
              <li key={`${c.kind}-${c.name}`} className={`sg-${c.kind === 'sätze' ? 'sets' : c.kind}`}>
                <span className="sg-badge">{tr(KIND[c.kind])}</span>
                <span><b>{c.name}</b>{c.detail && <small>{c.detail}</small>}</span>
              </li>
            ))}
          </ul>
          {kept(d).length > 0 && <p className="sg-kept">{tr('plan.suggestion.kept', { names: kept(d).join(', ') })}</p>}
        </section>
      ))}
    </Sheet>
  )
}
