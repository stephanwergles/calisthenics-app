import { postgresAdapter } from '@payloadcms/db-postgres'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Activities } from './collections/Activities'
import { Exercises } from './collections/Exercises'
import { Progressions } from './collections/Progressions'
import { Sessions } from './collections/Sessions'
import { Templates } from './collections/Templates'
import { Skills } from './collections/Skills'
import { Splits } from './collections/Splits'
import { Assessment } from './globals/Assessment'
import { Feedback } from './collections/Feedback'
import { Plans } from './collections/Plans'
import { Users } from './collections/Users'
import { Workouts } from './collections/Workouts'
import { WeekPlan } from './globals/WeekPlan'
import { syncHandler } from './sync/endpoint'
import { deleteAccountHandler } from './sync/account'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Lever' },
  },
  i18n: { supportedLanguages: { de, en }, fallbackLanguage: 'de' },
  collections: [Sessions, Activities, Plans, Feedback, Exercises, Progressions, Workouts, Skills, Splits, Templates, Users],
  globals: [WeekPlan, Assessment],
  // Abgleich mit der Trainings-App: POST /api/sync (siehe src/sync/endpoint.ts)
  endpoints: [
    { path: '/sync', method: 'post', handler: syncHandler },
    { path: '/account/delete', method: 'post', handler: deleteAccountHandler },
  ],
  // Die native App braucht kein CORS (kein Browser-Ursprung) – nur die eigene Seite
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
  // weder App noch Admin-Panel nutzen GraphQL – weniger Angriffsfläche
  graphQL: { disable: true },
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
    // Schema-Änderungen laufen über Migrationen (src/migrations), auch lokal –
    // so passiert auf dem Server genau das, was vorher getestet wurde.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
})
