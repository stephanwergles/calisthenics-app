/* Prototyp „Training aus Skills“: erzeugte Pläne für einige Beispielprofile lesbar ausgeben.

     node scripts/generate-plan.ts            (alle Profile)
     node scripts/generate-plan.ts stephan    (eines) */
import { readFileSync } from 'node:fs'
import type { Catalog, ExerciseMeta, GeneratorInput, Skill, SplitTemplate } from '../src/domain/model.ts'
import { placement, suggestSkills, suggestSplits, type AssessmentData } from '../src/domain/assessment.ts'
import { generatePlan, type GeneratorData } from '../src/domain/generator.ts'

const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
export const data: GeneratorData = {
  catalog: json('catalog.json') as Catalog,
  meta: json('exercise-meta.json').exercises as Record<string, ExerciseMeta>,
  skills: json('skills.json').skills as Skill[],
  splits: json('splits.json').splits as SplitTemplate[],
}

export const PROFILES: Record<string, { label: string; input: GeneratorInput }> = {
  stephan: { label: 'Muscle-up, L-Sit, Handstand · Stange, Ringe, Parallettes, Band · So/Mo/Mi · 90 min', input: {
    skills: ['muscle-up', 'l-sit', 'handstand'], equipment: ['bar', 'rings', 'parallettes', 'band'], days: ['sun', 'mon', 'wed'], minutes: 90,
    current: {}, split: 'ppl-3' } },
  zuhause: { label: 'Pistol, Handstand · nur Boden/Wand + Band · Di/Do/Sa · 45 min', input: {
    skills: ['pistol', 'handstand'], equipment: ['band'], days: ['tue', 'thu', 'sat'], minutes: 45, current: {} } },
  park: { label: 'Muscle-up, Planche · Stange, Barren · Mo/Di/Do/Fr · 60 min', input: {
    skills: ['muscle-up', 'planche'], equipment: ['bar', 'dip-bars'], days: ['mon', 'tue', 'thu', 'fri'], minutes: 60,
    current: { 'pull-up': 1, dip: 1 } } },
  zweitage: { label: 'L-Sit · Ringe, Parallettes · Sa/So · 75 min', input: {
    skills: ['l-sit'], equipment: ['rings', 'parallettes'], days: ['sat', 'sun'], minutes: 75, current: {} } },
}

const DAY: Record<string, string> = { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' }
const names = new Map(data.catalog.exercises.map(e => [e.id, e.name]))

if (import.meta.url === `file://${process.argv[1]}`) {
  const pick = process.argv[2]
  if (!pick || pick === 'onboarding') {
    // Onboarding-Ablauf: Kurztest → Startstufen → Skill-Vorschläge → Split-Vorschlag
    const assessment = json('assessment.json') as AssessmentData
    const results = { 'pull-ups': 9, dips: 20, 'push-ups': 30, hollow: 40, 'l-sit': 10, handstand: 30, pistol: 1, 'leg-raise': 10 }
    const current = placement(assessment, data.catalog, results)
    console.log('\n══ onboarding: Kurztest', JSON.stringify(results))
    console.log('  Startstufen:', Object.entries(current).map(([k, v]) => `${k} ${v + 1}`).join(', '))
    console.log('  Skill-Vorschläge:')
    for (const s of suggestSkills(data.skills, data.catalog, current))
      console.log(`    ${String(Math.round(s.score * 100)).padStart(3)} %  ${s.name}${s.missing.length ? ` – fehlt: ${s.missing.join(', ')}` : ''}${s.reached ? ' (erreicht)' : ''}`)
    console.log('  Split für 3 Tage:', suggestSplits(data.splits!, 3, ['pull', 'push', 'core']).map(s => s.name).join(' · '))
  }
  for (const [id, prof] of Object.entries(PROFILES)) {
    if (pick && pick !== id) continue
    const plan = generatePlan(data, prof.input)
    console.log(`\n══ ${id}: ${prof.label}`)
    for (const d of plan.days) {
      console.log(`\n  ${DAY[d.day]}${d.theme ? ` · ${d.theme}` : ''} · ${d.minutes} min · ${d.restBefore} Tag(e) seit letztem Training`)
      for (const s of d.slots) console.log(`    ${s.block.padEnd(9)} ${String(s.sets).padStart(2)} × ${(names.get(s.exercise) ?? s.exercise).padEnd(34)} ${String(s.minutes).padStart(4)} min  ${s.reason}`)
    }
    if (plan.warnings.length) console.log(`\n  Hinweise:\n${plan.warnings.map(w => `    – ${w}`).join('\n')}`)
  }
}
