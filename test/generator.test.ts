/* Prototyp „Training aus Skills“: Eigenschaften über viele Eingaben + Abnahme mit dem heutigen Profil */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Catalog, Equipment, ExerciseMeta, GeneratedPlan, GeneratorInput, Skill, Weekday } from '../src/domain/model.ts'
import { WEEK, adjacent, generatePlan, usable, type GeneratorData } from '../src/domain/generator.ts'

const json = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
const data: GeneratorData = {
  catalog: json('catalog.json') as Catalog,
  meta: json('exercise-meta.json').exercises as Record<string, ExerciseMeta>,
  skills: json('skills.json').skills as Skill[],
}
const region = new Map(data.catalog.progressions.map(p => [p.id, p.region]))

/* deterministische Zufallseingaben */
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) }
const EQUIP: Equipment[] = ['bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight']
function inputs(n: number): GeneratorInput[] {
  const r = rng(42), out: GeneratorInput[] = []
  const pick = <T,>(xs: T[], k: number) => [...xs].sort(() => r() - 0.5).slice(0, k)
  for (let i = 0; i < n; i++) {
    const skills = pick(data.skills.map(s => s.id), 1 + Math.floor(r() * 3))
    const equipment = pick(EQUIP, Math.floor(r() * (EQUIP.length + 1)))
    const days = pick(WEEK, 2 + Math.floor(r() * 4)) as Weekday[]
    const minutes = [45, 60, 75, 90, 120][Math.floor(r() * 5)]
    const current = Object.fromEntries(data.catalog.progressions.map(p => [p.id, Math.floor(r() * p.steps.length)]))
    out.push({ skills, equipment, days, minutes, current })
  }
  return out
}
const CASES = inputs(300).map(input => ({ input, plan: generatePlan(data, input) }))
const slots = (p: GeneratedPlan) => p.days.flatMap(d => d.slots.map(s => ({ ...s, day: d.day })))

test('nur Übungen mit vorhandenem Equipment', () => {
  for (const { input, plan } of CASES) for (const s of slots(plan))
    assert.ok(usable(data.meta[s.exercise], input.equipment), `${s.exercise} braucht ${JSON.stringify(data.meta[s.exercise].equipment)}, da: ${input.equipment}`)
})

test('jeder Ziel-Skill mindestens einmal pro Woche – oder ein Hinweis, warum nicht', () => {
  for (const { input, plan } of CASES) for (const id of input.skills) {
    const skill = data.skills.find(s => s.id === id)!
    const trained = slots(plan).some(s => s.kind === 'skill' && skill.targets.includes(s.progression))
    assert.ok(trained || plan.warnings.some(w => w.startsWith(skill.name)), `${skill.name} fehlt ohne Hinweis`)
  }
})

test('keine hohe Belastung derselben Sehne an Kalender-Folgetagen', () => {
  const high = (ex: string) => Object.entries(data.meta[ex].stress).filter(([, v]) => v >= 2).map(([t]) => t)
  for (const { plan } of CASES) {
    if (plan.warnings.some(w => w.includes('Sehnen-Konflikt'))) continue
    for (const a of plan.days) for (const b of plan.days) {
      if (a.day >= b.day || !adjacent(a.day, b.day)) continue
      const ta = new Set(a.slots.flatMap(s => high(s.exercise)))
      for (const s of b.slots) for (const t of high(s.exercise))
        assert.ok(!ta.has(t), `${t}: ${a.day} und ${b.day} (${s.exercise})`)
    }
  }
})

test('Zeitbudget je Einheit eingehalten – oder ein Hinweis', () => {
  for (const { input, plan } of CASES) for (const d of plan.days)
    assert.ok(d.minutes <= input.minutes || plan.warnings.some(w => w.startsWith(`${d.day}:`) && w.includes('über dem Budget')),
      `${d.day}: ${d.minutes} > ${input.minutes}`)
})

test('Zug/Druck ausgeglichen (Sätze, Faktor ≤ 1,5) – sofern das Equipment beides zulässt', () => {
  let checked = 0
  for (const { plan } of CASES) {
    if (plan.warnings.some(w => w.startsWith('Ausgleich') || w.startsWith('Zug/Druck'))) continue
    const sets = (r: string) => slots(plan).filter(s => region.get(s.progression) === r).reduce((n, s) => n + s.sets, 0)
    const pull = sets('pull'), push = sets('push')
    if (!pull || !push) continue
    checked++
    assert.ok(Math.max(pull, push) / Math.min(pull, push) <= 1.5, `Zug ${pull} : Druck ${push}`)
  }
  assert.ok(checked > 100, `zu wenige prüfbare Fälle: ${checked}`)
})

test('deterministisch: gleiche Eingabe, gleicher Plan', () => {
  for (const { input, plan } of CASES.slice(0, 30)) assert.deepEqual(generatePlan(data, input), plan)
})

test('Abnahme: heutiges Profil ergibt einen A/B/C-artigen Plan', () => {
  const plan = generatePlan(data, {
    skills: ['muscle-up', 'l-sit', 'handstand'], equipment: ['bar', 'rings', 'parallettes', 'band'],
    days: ['sun', 'mon', 'wed'], minutes: 90, current: {},
  })
  const day = (d: Weekday) => plan.days.find(x => x.day === d)!
  const skillsOn = (d: Weekday) => day(d).slots.filter(s => s.kind === 'skill').map(s => s.progression)
  // So = Tag A: Muscle-up (längste Pause davor), Zug-lastig
  assert.ok(skillsOn('sun').includes('muscle-up-pull'), 'Muscle-up am Sonntag')
  assert.ok(day('sun').slots.filter(s => region.get(s.progression) === 'pull').length >= 3, 'Sonntag zuglastig')
  // Mo = Tag C: folgt direkt auf Sonntag → keine Oberkörper-Skills, Beine
  assert.deepEqual(skillsOn('mon'), [], 'Montag ohne Skill-Arbeit am Oberkörper')
  assert.ok(day('mon').slots.some(s => region.get(s.progression) === 'legs'), 'Montag mit Beinen')
  // Mi = Tag B: Handstand und L-Sit
  assert.ok(skillsOn('wed').includes('handstand') && skillsOn('wed').includes('l-sit'), 'Handstand und L-Sit am Mittwoch')
  for (const d of plan.days) assert.ok(d.minutes <= 90)
  // Abweichungen zum heutigen Plan (dokumentiert, nicht erzwungen): Dips stehen am Sonntag
  // (Voraussetzung Muscle-up), Rumpf am Mittwoch statt Montag, kein Zubehör (Bizeps, Trizeps,
  // Waden, Fly), insgesamt weniger Sätze als der handgebaute Plan
})
