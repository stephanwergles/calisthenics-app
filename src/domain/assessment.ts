/* Prototyp v3: Einstufung, Skill-Vorschläge und Split-Vorschläge – reine Funktionen.
   Daten: src/seed/assessment.json, skills.json, splits.json. */
import type { AssessmentData, Catalog, ExerciseMeta, ProgressionId, Region, Skill, SkillId, SplitTemplate } from './model.ts'

export type { AssessmentData }

/** Kurztest-Ergebnisse → Startstufe je Leiter (nie über die letzte Stufe hinaus) */
export function placement(data: AssessmentData, catalog: Catalog, results: Record<string, number>): Record<ProgressionId, number> {
  const out: Record<ProgressionId, number> = {}
  for (const rule of data.rules) {
    const value = results[rule.test]
    const p = catalog.progressions.find(x => x.id === rule.progression)
    if (value == null || !p) continue
    const reached = rule.thresholds.filter(t => value >= t).length
    out[rule.progression] = Math.min(reached, p.steps.length - 1)
  }
  return out
}

export interface SkillSuggestion { skill: SkillId; name: string; score: number; reached: boolean; missing: string[]
  /** grobe Einordnung für die Anzeige: realistisch als Nächstes / mit Vorarbeit / langfristig */
  tier: 'next' | 'work' | 'long' }

/** Wie realistisch ist jeder Skill als Nächstes? Drei Teile:
    – Voraussetzungen erfüllt (40 %)
    – Abstand der Endstufe zum eigenen Niveau (35 %): Niveau = schwerste Stufe, die man schon trainiert
      (Index > 0); ohne Angaben Einsteiger (2). Je Schwierigkeitspunkt über dem Niveau ein Drittel weniger.
    – Fortschritt in der Ziel-Leiter (25 %)
    Ohne den Abstand stünde jeder Skill ohne Voraussetzungen (Human Flag, Back Lever) bei 70 % „bereit“.
    Erreichte Skills (letzte Stufe aller Ziel-Leitern) stehen am Ende. */
export function suggestSkills(skills: Skill[], catalog: Catalog, current: Record<ProgressionId, number>, meta: Record<string, ExerciseMeta> = catalog.meta ?? {}): SkillSuggestion[] {
  const steps = (pid: ProgressionId) => catalog.progressions.find(p => p.id === pid)?.steps ?? []
  const name = (pid: ProgressionId, i: number) => {
    const ex = steps(pid)[Math.min(i, steps(pid).length - 1)]?.exercise
    return catalog.exercises.find(e => e.id === ex)?.name ?? pid
  }
  const diff = (ex?: string) => (ex && meta[ex]?.difficulty) || 3
  const trained = Object.entries(current).filter(([, i]) => i > 0).map(([pid, i]) => diff(steps(pid)[Math.min(i, steps(pid).length - 1)]?.exercise))
  const level = Math.max(2, ...trained)
  return skills.map((s): SkillSuggestion => {
    const pre = s.prerequisites.map(p => Math.min(1, ((current[p.progression] ?? 0) + 1) / (p.minStep + 1)))
    const preScore = pre.length ? pre.reduce((a, b) => a + b, 0) / pre.length : 1
    const target = s.targets.map(pid => (current[pid] ?? 0) / Math.max(1, steps(pid).length - 1))
    const targetScore = target.length ? target.reduce((a, b) => a + b, 0) / target.length : 0
    const end = Math.max(...s.targets.map(pid => diff(steps(pid)[steps(pid).length - 1]?.exercise)))
    const gapScore = Math.max(0, 1 - Math.max(0, end - level) / 3)
    const reached = s.targets.every(pid => (current[pid] ?? 0) >= steps(pid).length - 1)
    const missing = s.prerequisites.filter(p => (current[p.progression] ?? 0) < p.minStep).map(p => name(p.progression, p.minStep))
    const score = Math.round((preScore * 0.4 + gapScore * 0.35 + targetScore * 0.25) * 100) / 100
    const tier = !missing.length && gapScore >= 0.66 ? 'next' : score >= 0.5 ? 'work' : 'long'
    return { skill: s.id, name: s.name, score, reached, missing, tier }
  }).sort((a, b) => Number(a.reached) - Number(b.reached) || b.score - a.score)
}

/** Passende Split-Vorlagen für die Zahl der Trainingstage, die naheliegendste zuerst */
export function suggestSplits(splits: SplitTemplate[], days: number, skillRegions: Region[]): SplitTemplate[] {
  const upperBoth = skillRegions.includes('pull') && skillRegions.includes('push')
  const prefer: Record<number, string[]> = {
    2: ['ul-2', 'full-2'],
    3: upperBoth ? ['ppl-3', 'full-3'] : ['full-3', 'ppl-3'],
    4: ['ul-4'],
    5: ['ppl-ul-5'],
    6: ['ppl-6'],
  }
  const order = prefer[days] ?? []
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : 99)
  return splits.filter(s => s.themes.length === days)
    .sort((a, b) => rank(a.id) - rank(b.id))
}
