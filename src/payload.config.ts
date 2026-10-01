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
import { Users } from './collections/Users'
import { Workouts } from './collections/Workouts'
import { WeekPlan } from './globals/WeekPlan'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Calisthenics' },
  },
  i18n: { supportedLanguages: { de, en }, fallbackLanguage: 'de' },
  collections: [Sessions, Activities, Exercises, Progressions, Workouts, Users],
  globals: [WeekPlan],
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
