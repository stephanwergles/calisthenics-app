import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'walk' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'hike' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'swim' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'row' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'climb' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'jumprope' BEFORE 'workout';
  ALTER TYPE "public"."enum_activities_kind" ADD VALUE 'other' BEFORE 'workout';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activities" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_activities_kind";
  CREATE TYPE "public"."enum_activities_kind" AS ENUM('run', 'ride', 'workout', 'challenge');
  ALTER TABLE "activities" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_activities_kind" USING "kind"::"public"."enum_activities_kind";`)
}
