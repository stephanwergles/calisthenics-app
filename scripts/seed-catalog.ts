/* Katalog (src/seed/catalog.json) in die Datenbank spielen.

     npm run seed

   Upsert über die stabilen IDs: beliebig oft ausführbar, ändert bestehende
   Einträge statt sie zu doppeln. Löscht nichts. */
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { AssessmentData, Catalog, ExerciseMeta, Skill, SplitTemplate, Template } from '../src/domain/model.ts'
import { catalogToDocs, metaToDoc, skillToDoc, splitToDoc, templateToDoc } from '../src/sync/convert.ts'

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/seed/catalog.json', import.meta.url), 'utf8'))
const payload = await getPayload({ config })

async function upsert(collection: 'exercises' | 'progressions' | 'workouts', id: string, data: Record<string, unknown>) {
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, pagination: false })
  if (found.docs.length) await payload.update({ collection, id, data: data as never, depth: 0 })
  else await payload.create({ collection, data: { id, ...data } as never, depth: 0 })
}

const docs = catalogToDocs(catalog)
for (const e of docs.exercises) await upsert('exercises', e.id, e.data)
for (const p of docs.progressions) await upsert('progressions', p.id, p.data)
for (const w of docs.workouts) await upsert('workouts', w.id, w.data)
await payload.updateGlobal({ slug: 'weekplan', data: docs.weekplan as never, depth: 0 })

/* ── v3: Metadaten, Skills, Split-Vorlagen, Einstufung ──
   Quelle ist danach Payload (Admin-Panel): hier wird nur angelegt, was fehlt – gepflegte
   Einträge überschreibt ein Deploy nie. */
const seed = (f: string) => JSON.parse(readFileSync(new URL(`../src/seed/${f}`, import.meta.url), 'utf8'))
const meta = seed('exercise-meta.json').exercises as Record<string, ExerciseMeta>
const skills = seed('skills.json').skills as Skill[]
const splits = seed('splits.json').splits as SplitTemplate[]
const assessment = seed('assessment.json') as AssessmentData
let added = 0
for (const [id, m] of Object.entries(meta)) {
  const e = (await payload.find({ collection: 'exercises', where: { id: { equals: id } }, limit: 1, depth: 0 })).docs[0] as { meta?: { pattern?: string; stress?: Record<string, number | null> } } | undefined
  if (e && !e.meta?.pattern) { await payload.update({ collection: 'exercises', id, data: { meta: metaToDoc(m) } as never, depth: 0 }); added++ }
  else if (e?.meta) {
    // neu hinzugekommene Gelenke (leer = nie gepflegt) aus dem Seed nachtragen – gepflegte Werte bleiben
    const stress = metaToDoc(m).stress
    const fill = Object.fromEntries(Object.entries(stress).filter(([k]) => e.meta!.stress?.[k] == null))
    if (Object.keys(fill).length) { await payload.update({ collection: 'exercises', id, data: { meta: { ...e.meta, stress: { ...e.meta.stress, ...fill } } } as never, depth: 0 }); added++ }
  }
}
for (const r of assessment.rules) {
  const p = (await payload.find({ collection: 'progressions', where: { id: { equals: r.progression } }, limit: 1, depth: 0 })).docs[0] as { assessment?: { test?: string } } | undefined
  if (p && !p.assessment?.test) { await payload.update({ collection: 'progressions', id: r.progression, data: { assessment: { test: r.test, thresholds: r.thresholds } } as never, depth: 0 }); added++ }
}
const createMissing = async (collection: 'skills' | 'splits' | 'templates', id: string, data: Record<string, unknown>) => {
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0 })
  if (!found.docs.length) { await payload.create({ collection, data: { id, ...data } as never, depth: 0 }); added++ }
}
for (const s of skills) await createMissing('skills', s.id, skillToDoc(s))
for (const t of splits) await createMissing('splits', t.id, splitToDoc(t))
for (const t of (seed('templates.json').templates as Template[])) await createMissing('templates', t.id, templateToDoc(t))
/* Katalog-Ausbau 14.10.2026: neue Stufen vorn/mittig in l-sit, handstand, vertical-push verschieben die
   Indizes. Nur Werte, die noch genau dem alten Stand entsprechen, werden umgestellt – im Admin gepflegte
   Werte bleiben. Idempotent: nach der Umstellung passt der alte Wert nicht mehr. */
const idOf = (v: unknown) => (typeof v === 'object' && v ? (v as { id: string }).id : v as string)
const STEP_MOVES: { skill: string; progression: string; from: number; to: number }[] = [
  { skill: 'handstand-push-up', progression: 'handstand', from: 1, to: 3 },
  { skill: 'human-flag', progression: 'handstand', from: 0, to: 1 },
  { skill: 'freestanding-hspu', progression: 'handstand', from: 2, to: 5 },
  { skill: 'freestanding-hspu', progression: 'vertical-push', from: 2, to: 3 },
  { skill: 'press-handstand', progression: 'handstand', from: 2, to: 5 },
  { skill: 'v-sit', progression: 'l-sit', from: 1, to: 3 },
]
let fixed = 0
for (const sid of [...new Set(STEP_MOVES.map(m => m.skill))]) {
  const doc = (await payload.find({ collection: 'skills', where: { id: { equals: sid } }, limit: 1, depth: 0 })).docs[0] as { prerequisites?: { progression: unknown; minStep: number }[] } | undefined
  if (!doc?.prerequisites) continue
  let changed = false
  const prerequisites = doc.prerequisites.map(p => {
    const m = STEP_MOVES.find(x => x.skill === sid && x.progression === idOf(p.progression) && x.from === p.minStep)
    if (!m) return { progression: idOf(p.progression), minStep: p.minStep }
    changed = true
    return { progression: idOf(p.progression), minStep: m.to }
  })
  if (changed) { await payload.update({ collection: 'skills', id: sid, data: { prerequisites } as never, depth: 0 }); fixed++ }
}
const THRESHOLD_MOVES: Record<string, { from: number[]; to: number[] }> = {
  'l-sit': { from: [20, 30], to: [5, 10, 20, 30] },
  handstand: { from: [45, 60], to: [15, 30, 45, 60] },
  'vertical-push': { from: [30, 60], to: [30, 45, 60] },
}
for (const [pid, m] of Object.entries(THRESHOLD_MOVES)) {
  const p = (await payload.find({ collection: 'progressions', where: { id: { equals: pid } }, limit: 1, depth: 0 })).docs[0] as { assessment?: { test?: string; thresholds?: number[] } } | undefined
  if (p?.assessment?.test && JSON.stringify(p.assessment.thresholds ?? []) === JSON.stringify(m.from)) {
    await payload.update({ collection: 'progressions', id: pid, data: { assessment: { test: p.assessment.test, thresholds: m.to } } as never, depth: 0 }); fixed++
  }
}
// neue Leiter als Unterstützung des Ring-Muscle-ups
const rmu = (await payload.find({ collection: 'skills', where: { id: { equals: 'ring-muscle-up' } }, limit: 1, depth: 0 })).docs[0] as { support?: unknown[] } | undefined
if (rmu && !(rmu.support ?? []).map(idOf).includes('ring-dip')) {
  await payload.update({ collection: 'skills', id: 'ring-muscle-up', data: { support: [...(rmu.support ?? []).map(idOf), 'ring-dip'] } as never, depth: 0 }); fixed++
}
if (fixed) console.log(`Katalog-Ausbau: ${fixed} Verweise auf neue Stufen umgestellt`)

const g = await payload.findGlobal({ slug: 'assessment', depth: 0 }) as { tests?: unknown[] }
if (!g.tests?.length) {
  await payload.updateGlobal({ slug: 'assessment', data: { tests: assessment.tests.map(t => ({ key: t.id, name: t.name, unit: t.unit, levels: t.levels ?? [] })) } as never, depth: 0 })
  added++
}

console.log(`v3-Katalog: ${added} fehlende Einträge angelegt (Metadaten, Einstufung, Skills, Split-Vorlagen, Vorlagen)`)
console.log(`Katalog eingespielt: ${catalog.exercises.length} Übungen, ${catalog.progressions.length} Progressionen, ${catalog.workouts.length} Workouts, Wochenplan`)
process.exit(0)
