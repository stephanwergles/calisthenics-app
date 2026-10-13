'use client'
/* Planvorschlag: Generator mit Profil + Stand, als Diff gegen den aktuellen Plan. Nichts ändert
   sich ohne Bestätigung. „Später“ blendet genau diesen Vorschlag aus (pro Gerät); ändern sich
   Ziele, Tage, Ausrüstung oder Stufen, entsteht ein neuer. Rückgängig = vorherige Fassung. */
import { useMemo, useState } from 'react'
import type { Plan, SplitTemplate } from '@/domain/model'
import { generatePlan } from '@/domain/generator'
import { META } from './meta'
import splitsJson from '@/seed/splits.json'
import * as L from './logic'
import type { Training } from './useTraining'
import { SKILLS } from './components/ProfileParts'

const SPLITS = (splitsJson as unknown as { splits: SplitTemplate[] }).splits
const DISMISSED = 'lever-suggestion-dismissed'
const PREVIOUS = 'lever-plan-previous'
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ohne Speicher */ } }

export interface Suggestion { plan: Plan; diff: L.DayDiff[]; warnings: string[]; changes: number }

export function usePlanSuggestion(t: Training) {
  const input = useMemo(() => L.generatorInput(t.ix, t.state, SKILLS, SPLITS), [t.ix, t.state])
  const sig = input ? JSON.stringify(input) : ''
  const [dismissed, setDismissed] = useState(() => read(DISMISSED))
  const [previous, setPrevious] = useState(() => read(PREVIOUS))

  const suggestion = useMemo((): Suggestion | null => {
    if (!input) return null
    const g = generatePlan({ catalog: t.ix.catalog, meta: META, skills: SKILLS, splits: SPLITS }, input)
    const plan = L.planFromGenerated(t.ix, t.plan ?? L.planFromCatalog(t.baseCatalog), g, input)
    if (L.samePlan(t.ix, plan)) return null
    const diff = L.planDiff(t.ix, t.state, plan)
    return { plan, diff, warnings: g.warnings, changes: diff.reduce((n, d) => n + d.changes.filter(c => c.kind !== 'bleibt').length, 0) }
  }, [sig, t.ix]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => { write(DISMISSED, sig); setDismissed(sig) }
  const accept = () => {
    if (!suggestion) return
    const prev = JSON.stringify(t.plan ?? null)
    write(PREVIOUS, prev); setPrevious(prev)
    t.savePlan(suggestion.plan)
    dismiss()
  }
  const undo = () => {
    if (previous === null) return
    const prev = JSON.parse(previous) as Plan | null
    t.savePlan(prev ?? L.planFromCatalog(t.baseCatalog))
    write(PREVIOUS, null); setPrevious(null)
    dismiss()
  }
  return {
    suggestion: suggestion && dismissed !== sig ? suggestion : null,
    /** ein ausgeblendeter Vorschlag lässt sich wieder ansehen */
    hidden: suggestion && dismissed === sig ? suggestion : null,
    hasGoals: !!input, accept, dismiss, undo, canUndo: previous !== null,
    show: () => { write(DISMISSED, null); setDismissed(null) },
  }
}
export type PlanSuggestion = ReturnType<typeof usePlanSuggestion>
