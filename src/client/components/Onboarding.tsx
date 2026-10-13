'use client'
/* Onboarding für neue Installationen: Willkommen → Kurztest → Ziele → Ausrüstung → Tage & Dauer
   → Planvorschlag. Ein Sheet, die Schritte als Push-Seiten (Zurück-Wischen geht einen Schritt
   zurück). Jeder Schritt ist überspringbar; ohne Ziele bleibt der Standardplan. */
import { useState } from 'react'
import type { Training } from '../useTraining'
import type { PlanSuggestion } from '../usePlanSuggestion'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { DISCLAIMER_VERSION } from '../consent'
import { AssessmentPage, DaysSheet, EquipmentSheet, GoalPicker } from './ProfileParts'
import { SuggestionSheet } from './SuggestionSheet'
import { TemplatesSheet } from './TemplatesSheet'
import { Sheet } from './Sheets'
import { Icon } from './Icon'
import { t as tr } from '../i18n'

const DONE = 'lever-onboarded'
const done = () => { try { return localStorage.getItem(DONE) === '1' } catch { return false } }
const markDone = () => { try { localStorage.setItem(DONE, '1') } catch { /* ohne Speicher */ } }

/** Nur bei frischer Installation: keine Einheiten, kein Profil, kein eigener Plan – und erst nach dem Gesundheits-Hinweis */
export const needsOnboarding = (t: Training) =>
  t.loaded && !t.sessions.length && !t.state.profile && !t.plan && t.consent.disclaimer === DISCLAIMER_VERSION && !done()

const STEPS = ['welcome', 'assessment', 'goals', 'equipment', 'days', 'suggestion'] as const
const SHEET_ID: Record<(typeof STEPS)[number], string> = {
  welcome: 'onboarding', assessment: 'assessment', goals: 'goals', equipment: 'equipment', days: 'days', suggestion: 'suggestion',
}
const TITLE = (step: (typeof STEPS)[number]) => tr(`onboarding.step.${step}`)

export function Onboarding({ t, ps, onClose }: { t: Training; ps: PlanSuggestion; onClose: () => void }) {
  const native = useNativeShell()
  const [at, setAt] = useState(0)
  const [library, setLibrary] = useState(false)
  const finish = () => { markDone(); onClose() }
  const go = (i: number) => setAt(i)
  const parentOf = (i: number) => ({ id: SHEET_ID[STEPS[i - 1]], title: TITLE(STEPS[i - 1]) })
  const back = (i: number) => () => setAt(i - 1)
  const hasGoals = ps.hasGoals
  const intro = tr('onboarding.intro')

  useNativeSheet(native ? {
    id: 'onboarding', title: tr('onboarding.title'), subtitle: tr('onboarding.subtitle'), detents: ['large'],
    blocks: [
      { type: 'text', text: intro, style: 'body' },
      { type: 'button', id: 'library', title: tr('onboarding.library'), symbol: 'square.grid.2x2' },
      { type: 'button', id: 'skip', title: tr('onboarding.skip') },
    ] as NBlock[],
    footer: [{ id: 'start', title: tr('onboarding.fromGoals'), symbol: 'arrow.right', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'start') go(1)
    else if (e.type === 'tap' && e.id === 'library') setLibrary(true)
    else if (e.type === 'tap' && e.id === 'skip') finish()
    else if (e.type === 'dismiss') finish()
  })

  const pages = <>
    {library && <TemplatesSheet t={t} ps={ps} plansOnly parent={{ id: 'onboarding', title: TITLE('welcome') }} onClose={() => setLibrary(false)} onDone={finish} />}
    {at >= 1 && <AssessmentPage t={t} parent={parentOf(1)} onClose={back(1)} onDone={() => go(2)} />}
    {at >= 2 && <GoalPicker t={t} parent={parentOf(2)} onClose={back(2)} next={{ title: tr('common.next'), onNext: () => go(3) }} />}
    {at >= 3 && <EquipmentSheet t={t} parent={parentOf(3)} onClose={back(3)} next={{ title: tr('common.next'), onNext: () => go(4) }} />}
    {at >= 4 && <DaysSheet t={t} parent={parentOf(4)} onClose={back(4)}
      next={{ title: hasGoals && ps.suggestion ? tr('onboarding.suggest') : tr('common.done'), onNext: () => (hasGoals && ps.suggestion ? go(5) : finish()) }} />}
    {at >= 5 && ps.suggestion && <SuggestionSheet t={t} s={ps.suggestion} ps={ps} parent={parentOf(5)} onClose={back(5)} onDone={finish} />}
  </>
  if (native) return pages
  return (
    <>
      <Sheet large title={tr('onboarding.title')} sub={tr('onboarding.subtitle')} onClose={finish}
        footer={<div className="sg-foot">
          <button className="btn btn-primary btn-block" onClick={() => go(1)}>{tr('onboarding.fromGoals')} <Icon name="right" size={18} /></button>
          <button className="btn btn-secondary btn-block" onClick={() => setLibrary(true)}>{tr('onboarding.library')}</button>
          <button className="btn btn-ghost btn-block" onClick={finish}>{tr('onboarding.skip')}</button>
        </div>}>
        <p className="hint">{intro}</p>
      </Sheet>
      {pages}
    </>
  )
}
