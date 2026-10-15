import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/* Vorlagen: „Tag A/B/C“ heißen nach Inhalt (Pull/Push/Lower) – Vorlagen spielt der Seed nur ein, wenn
   sie fehlen, deshalb hier. Nur exakte alte Namen, von Hand gepflegte bleiben unberührt. */
const MAP = [['Tag A', 'Pull'], ['Tag B', 'Push'], ['Tag C', 'Lower']] as const

const rename = (from: string, to: string) => sql`
  UPDATE "templates" SET "workouts" = (
    SELECT jsonb_agg(CASE WHEN w->>'name' = ${from} THEN jsonb_set(w, '{name}', to_jsonb(${to}::text)) ELSE w END)
    FROM jsonb_array_elements("workouts") w
  ) WHERE jsonb_typeof("workouts") = 'array' AND "workouts" @> ${JSON.stringify([{ name: from }])}::jsonb;`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [from, to] of MAP) await db.execute(rename(from, to))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [from, to] of MAP) await db.execute(rename(to, from))
}
