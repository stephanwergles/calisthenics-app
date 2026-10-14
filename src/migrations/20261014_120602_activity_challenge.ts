import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'challenge';
  ALTER TABLE "activities" ADD COLUMN "challenge" varchar;
  ALTER TABLE "activities" ADD COLUMN "value" numeric;
  ALTER TABLE "activities" ADD COLUMN "duration_sec" numeric;
  ALTER TABLE "activities" ADD COLUMN "parts" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_activities_kind";
  CREATE TYPE "public"."enum_activities_kind" AS ENUM('run', 'ride', 'workout');
  ALTER TABLE "activities" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_activities_kind" USING "kind"::"public"."enum_activities_kind";
  ALTER TABLE "activities" DROP COLUMN "challenge";
  ALTER TABLE "activities" DROP COLUMN "value";
  ALTER TABLE "activities" DROP COLUMN "duration_sec";
  ALTER TABLE "activities" DROP COLUMN "parts";`)
}
