/* Katalog (src/seed/catalog.json) in die Datenbank spielen.

     npm run seed

   Upsert über die stabilen IDs: beliebig oft ausführbar, ändert bestehende
   Einträge statt sie zu doppeln. Löscht nichts. */
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { AssessmentData, Catalog, ExerciseMeta, Skill, SplitTemplate } from '../src/domain/model.ts'
import { catalogToDocs, metaToDoc, skillToDoc, splitToDoc } from '../src/sync/convert.ts'

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
  const e = (await payload.find({ collection: 'exercises', where: { id: { equals: id } }, limit: 1, depth: 0 })).docs[0] as { meta?: { pattern?: string } } | undefined
  if (e && !e.meta?.pattern) { await payload.update({ collection: 'exercises', id, data: { meta: metaToDoc(m) } as never, depth: 0 }); added++ }
}
for (const r of assessment.rules) {
  const p = (await payload.find({ collection: 'progressions', where: { id: { equals: r.progression } }, limit: 1, depth: 0 })).docs[0] as { assessment?: { test?: string } } | undefined
  if (p && !p.assessment?.test) { await payload.update({ collection: 'progressions', id: r.progression, data: { assessment: { test: r.test, thresholds: r.thresholds } } as never, depth: 0 }); added++ }
}
const createMissing = async (collection: 'skills' | 'splits', id: string, data: Record<string, unknown>) => {
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0 })
  if (!found.docs.length) { await payload.create({ collection, data: { id, ...data } as never, depth: 0 }); added++ }
}
for (const s of skills) await createMissing('skills', s.id, skillToDoc(s))
for (const t of splits) await createMissing('splits', t.id, splitToDoc(t))
const g = await payload.findGlobal({ slug: 'assessment', depth: 0 }) as { tests?: unknown[] }
if (!g.tests?.length) {
  await payload.updateGlobal({ slug: 'assessment', data: { tests: assessment.tests.map(t => ({ key: t.id, name: t.name, unit: t.unit, levels: t.levels ?? [] })) } as never, depth: 0 })
  added++
}

console.log(`v3-Katalog: ${added} fehlende Einträge angelegt (Metadaten, Einstufung, Skills, Split-Vorlagen)`)
console.log(`Katalog eingespielt: ${catalog.exercises.length} Übungen, ${catalog.progressions.length} Progressionen, ${catalog.workouts.length} Workouts, Wochenplan`)
process.exit(0)
