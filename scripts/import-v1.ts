/* v1-Export für eine Person in die Datenbank übernehmen.

     npm run import:v1 -- <export.json> <email>

   Die Person muss existieren (im Admin unter /admin anlegen). Sessions und
   Aktivitäten werden über ihren Schlüssel (datum-workout) abgeglichen: ein
   erneuter Import aktualisiert statt zu doppeln. Löscht nichts. */
import { readFileSync } from 'node:fs'
import { getPayload } from 'payload'
import config from '@payload-config'
import { migrate } from '../src/migrate/from-v1.ts'

// `payload run` reicht nur Positionsargumente durch (Flags wie --email schluckt es)
const args = process.argv.slice(2)
const file = args.find(a => a.endsWith('.json'))
const email = args.find(a => a.includes('@') && !a.endsWith('.json'))
if (!file || !email) {
  console.error('Aufruf: npm run import:v1 -- <export.json> <email>')
  process.exit(1)
}

const payload = await getPayload({ config })
const users = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0 })
if (!users.docs.length) {
  console.error(`Keine Person mit ${email} – zuerst unter /admin anlegen.`)
  process.exit(1)
}
const user = users.docs[0].id

const { data, warnings, dropped } = migrate(JSON.parse(readFileSync(file, 'utf8')))

async function upsert(collection: 'sessions' | 'activities', key: string, doc: Record<string, unknown>) {
  const found = await payload.find({
    collection, depth: 0, limit: 1, pagination: false,
    where: { and: [{ user: { equals: user } }, { key: { equals: key } }] },
  })
  if (found.docs.length) { await payload.update({ collection, id: found.docs[0].id, data: doc as never, depth: 0 }); return 'update' }
  await payload.create({ collection, data: { ...doc, user, key } as never, depth: 0 }); return 'neu'
}

const count = { neu: 0, update: 0 }
for (const s of data.sessions) {
  count[await upsert('sessions', s.id, {
    date: s.date, workout: s.workout, durationSec: s.durationSec ?? null,
    sets: s.sets, skipped: s.skipped, routineDone: s.routineDone,
  })]++
}
for (const a of data.activities) {
  const { id, ...rest } = a
  count[await upsert('activities', id, rest)]++
}
await payload.update({ collection: 'users', id: user, data: { state: data.state } as never, depth: 0 })

const sets = data.sessions.reduce((n, s) => n + s.sets.length, 0)
console.log(`${data.sessions.length} Einheiten (${sets} Sätze), ${data.activities.length} Aktivitäten → ${count.neu} neu, ${count.update} aktualisiert`)
if (dropped.length) console.log(`  · ${dropped.length} leere Tage verworfen: ${dropped.join(', ')}`)
warnings.forEach(w => console.log('  ! ' + w))
process.exit(0)
