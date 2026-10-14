'use client'
/* Planvorschlag: Generator mit Profil + Stand, als Diff gegen den aktuellen Plan. Nichts ändert
   sich ohne Bestätigung. „Später“ blendet genau diesen Vorschlag aus (pro Gerät); ändern sich
   Ziele, Tage, Ausrüstung oder Stufen, entsteht ein neuer. Rückgängig = vorherige Fassung. */
import { useMemo, useState } from 'react'
import type { Plan } from '../domain/model.ts'
import { generatePlan } from '../domain/generator.ts'
import { catalogData } from './data.ts'
import * as L from './logic.ts'
import type { Training } from './useTraining.ts'
import { toast } from './toast.ts'
import { getLocale, t as tr } from './i18n/index.ts'
import { platform } from './platform.ts'

const DISMISSED = 'lever-suggestion-dismissed'
const PREVIOUS = 'lever-plan-previous'
const read = (k: string) => platform().prefs.get(k)
const write = (k: string, v: string | null) => platform().prefs.set(k, v)

export interface Suggestion { plan: Plan; diff: L.DayDiff[]; warnings: string[]; changes: number }

export function usePlanSuggestion(t: Training) {
  const data = catalogData(t.ix.catalog)
  const input = useMemo(() => L.generatorInput(t.ix, t.state, data.skills, data.splits), [t.ix, t.state, data])
  const sig = input ? JSON.stringify(input) : ''
  const [dismissed, setDismissed] = useState(() => read(DISMISSED))
  const [previous, setPrevious] = useState(() => read(PREVIOUS))

  const suggestion = useMemo((): Suggestion | null => {
    if (!input) return null
    const g = generatePlan({ catalog: t.ix.catalog, meta: data.meta, skills: data.skills, splits: data.splits }, input)
    const plan = L.planFromGenerated(t.ix, t.plan ?? L.planFromCatalog(t.baseCatalog), g, input)
    if (L.samePlan(t.ix, plan)) return null
    const diff = L.planDiff(t.ix, t.state, plan)
    return { plan, diff, warnings: g.warnings, changes: diff.reduce((n, d) => n + d.changes.filter(c => c.kind !== 'bleibt').length, 0) }
  }, [sig, t.ix, getLocale()]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => { write(DISMISSED, sig); setDismissed(sig) }
  const accept = () => {
    if (!suggestion) return
    const prev = JSON.stringify(t.plan ?? null)
    write(PREVIOUS, prev); setPrevious(prev)
    t.savePlan(suggestion.plan)
    dismiss()
    toast(tr('common.toast.suggestionApplied'), 'success')
  }
  /** beliebigen Plan übernehmen (z. B. eine Vorlage) – rückgängig wie ein Vorschlag */
  const apply = (plan: Plan) => {
    const prev = JSON.stringify(t.plan ?? null)
    write(PREVIOUS, prev); setPrevious(prev)
    t.savePlan(plan)
    toast(tr('common.toast.planApplied'), 'success')
  }
  const undo = () => {
    if (previous === null) return
    const prev = JSON.parse(previous) as Plan | null
    t.savePlan(prev ?? L.planFromCatalog(t.baseCatalog))
    write(PREVIOUS, null); setPrevious(null)
    dismiss()
    toast(tr('common.toast.undone'))
  }
  return {
    suggestion: suggestion && dismissed !== sig ? suggestion : null,
    /** ein ausgeblendeter Vorschlag lässt sich wieder ansehen */
    hidden: suggestion && dismissed === sig ? suggestion : null,
    hasGoals: !!input, accept, dismiss, undo, apply, canUndo: previous !== null,
    show: () => { write(DISMISSED, null); setDismissed(null) },
  }
}
export type PlanSuggestion = ReturnType<typeof usePlanSuggestion>
