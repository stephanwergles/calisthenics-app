/* Katalog (src/seed/catalog.json) in die Datenbank spielen.

     npm run seed

   Upsert über die stabilen IDs: beliebig oft ausführbar, ändert bestehende
   Einträge statt sie zu doppeln. Löscht nichts. */
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Catalog } from '../src/domain/model.ts'

const catalog: Catalog = JSON.parse(readFileSync(new URL('../src/seed/catalog.json', import.meta.url), 'utf8'))
const payload = await getPayload({ config })

async function upsert(collection: 'exercises' | 'progressions' | 'workouts', id: string, data: Record<string, unknown>) {
  const found = await payload.find({ collection, where: { id: { equals: id } }, limit: 1, depth: 0, pagination: false })
  if (found.docs.length) await payload.update({ collection, id, data: data as never, depth: 0 })
  else await payload.create({ collection, data: { id, ...data } as never, depth: 0 })
}

for (const e of catalog.exercises) {
  const { id, ...rest } = e
  await upsert('exercises', id, rest)
}
for (const p of catalog.progressions) await upsert('progressions', p.id, { steps: p.steps })
for (const w of catalog.workouts) {
  const routine = (items: typeof w.warmup) =>
    items.map(({ id, name, detail, cardio }) => ({ key: id, name, detail, cardio: !!cardio }))
  await upsert('workouts', w.id, {
    name: w.name, focus: w.focus, slots: w.slots, warmup: routine(w.warmup), cooldown: routine(w.cooldown),
  })
}
await payload.updateGlobal({ slug: 'weekplan', data: catalog.weekplan as never, depth: 0 })

console.log(`Katalog eingespielt: ${catalog.exercises.length} Übungen, ${catalog.progressions.length} Progressionen, ${catalog.workouts.length} Workouts, Wochenplan`)
process.exit(0)
