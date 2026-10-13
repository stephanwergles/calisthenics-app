'use client'
/* Planvorschlag ansehen: je Wochentag vorher → nachher, was dazukommt, wegfällt, sich ändert.
   Erst „Übernehmen“ schreibt eine neue Planversion. */
import type { Training } from '../useTraining'
import type { PlanSuggestion, Suggestion } from '../usePlanSuggestion'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { DAY_NAME } from './PlanEditor'
import { SKILLS } from './ProfileParts'
import { Sheet } from './Sheets'
import * as L from '../logic'

const KIND: Record<string, string> = { neu: 'neu', raus: 'raus', sätze: 'Sätze' }

export function SuggestionSheet({ t, s, ps, onClose, parent, onDone }: {
  t: Training; s: Suggestion; ps: PlanSuggestion; onClose: () => void
  /** Onboarding: als Push-Seite; onDone nach Übernehmen/Später */
  parent?: { id: string; title: string }; onDone?: () => void
}) {
  const native = useNativeShell()
  const goals = L.profileOf(t.ix, t.state).goals.map(g => SKILLS.find(x => x.id === g)?.name ?? g).join(', ')
  const version = (t.plan?.version ?? 0)
  const sub = `Für ${goals} · ${s.changes} ${s.changes === 1 ? 'Änderung' : 'Änderungen'}`
  const intro = 'Aus deinen Zielen, Trainingstagen, deiner Ausrüstung und deinem Stand. Nichts ändert sich, bevor du übernimmst – danach lässt es sich im Plan rückgängig machen.'
  const head = (d: L.DayDiff) => `${DAY_NAME[d.day]} · ${d.before ?? 'Ruhetag'} → ${d.after ?? 'Ruhetag'}`
  const kept = (d: L.DayDiff) => d.changes.filter(c => c.kind === 'bleibt').map(c => c.name)
  const accept = () => { ps.accept(); (onDone ?? onClose)() }
  const later = () => { ps.dismiss(); (onDone ?? onClose)() }

  useNativeSheet(native ? {
    id: 'suggestion', parent: parent?.id, title: 'Planvorschlag', subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'text', text: intro, style: 'muted' },
      ...s.warnings.map((w): NBlock => ({ type: 'text', text: w, style: 'warn' })),
      ...s.diff.flatMap((d): NBlock[] => [
        { type: 'section', title: head(d) },
        ...d.changes.filter(c => c.kind !== 'bleibt').map((c): NBlock => ({ type: 'row', title: c.name, subtitle: c.detail, trailing: KIND[c.kind], symbol: 'none' })),
        ...(kept(d).length ? [{ type: 'text', text: `Bleibt: ${kept(d).join(', ')}`, style: 'small' } as NBlock] : []),
      ]),
    ],
    footer: [{ id: 'accept', title: `Übernehmen · Plan v${version + 1}`, symbol: 'checkmark', style: 'prominent' }, { id: 'later', title: 'Später' }],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'accept') accept()
    else if (e.type === 'tap' && e.id === 'later') later()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title="Planvorschlag" sub={sub} back={parent?.title} onClose={onClose}
      footer={<div className="sg-foot">
        <button className="btn btn-primary btn-block" onClick={accept}>Übernehmen · Plan v{version + 1}</button>
        <button className="btn btn-secondary btn-block" onClick={later}>Später</button>
      </div>}>
      <p className="hint">{intro}</p>
      {s.warnings.map(w => <p key={w} className="warn">{w}</p>)}
      {s.diff.map(d => (
        <section key={d.day} className="sg-day">
          <h4 className="pe-section">{head(d)}</h4>
          <ul>
            {d.changes.filter(c => c.kind !== 'bleibt').map(c => (
              <li key={`${c.kind}-${c.name}`} className={`sg-${c.kind === 'sätze' ? 'sets' : c.kind}`}>
                <span className="sg-badge">{KIND[c.kind]}</span>
                <span><b>{c.name}</b>{c.detail && <small>{c.detail}</small>}</span>
              </li>
            ))}
          </ul>
          {kept(d).length > 0 && <p className="sg-kept">Bleibt: {kept(d).join(', ')}</p>}
        </section>
      ))}
    </Sheet>
  )
}
