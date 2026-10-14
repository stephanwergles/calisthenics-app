import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exercises" ADD COLUMN "meta_stress_hip" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_back" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_ankle" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exercises" DROP COLUMN "meta_stress_hip";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_back";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_ankle";`)
}
