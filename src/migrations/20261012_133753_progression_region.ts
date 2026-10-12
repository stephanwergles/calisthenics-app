import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_progressions_region" AS ENUM('pull', 'push', 'core', 'legs');
  ALTER TABLE "progressions" ADD COLUMN "region" "enum_progressions_region";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "progressions" DROP COLUMN "region";
  DROP TYPE "public"."enum_progressions_region";`)
}
