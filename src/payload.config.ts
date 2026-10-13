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
  collections: [Sessions, Activities, Plans, Feedback, Exercises, Progressions, Workouts, Users],
  globals: [WeekPlan],
  // Abgleich mit der Trainings-App: POST /api/sync (siehe src/sync/endpoint.ts)
  endpoints: [
    { path: '/sync', method: 'post', handler: syncHandler },
    { path: '/account/delete', method: 'post', handler: deleteAccountHandler },
  ],
  // iOS-App (Capacitor) lädt die Oberfläche aus dem App-Paket und ruft die API von dort aus auf
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || '', 'capacitor://localhost'].filter(Boolean),
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
