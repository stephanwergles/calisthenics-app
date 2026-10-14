import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/* Daten: Leiter „one-arm-pull“ (Uneven → Archer → Typewriter) hieß wie der Skill „Einarmiger
   Klimmzug“ und erschien auf dessen Seite als Voraussetzung und Ergänzung – verwechselbar mit der
   Ziel-Leiter. Nur umbenennen, wenn der Name noch der alte ist (im Admin gepflegte Namen bleiben);
   updated_at setzen, damit die Apps den Katalog neu laden. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "progressions" SET "name" = 'Asymmetrische Klimmzüge', "updated_at" = now()
   WHERE "id" = 'one-arm-pull' AND ("name" = 'Einarmiger Klimmzug' OR "name" IS NULL);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "progressions" SET "name" = 'Einarmiger Klimmzug', "updated_at" = now()
   WHERE "id" = 'one-arm-pull' AND "name" = 'Asymmetrische Klimmzüge';`)
}
