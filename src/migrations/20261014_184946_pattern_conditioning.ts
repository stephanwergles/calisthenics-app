import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_exercises_meta_pattern" ADD VALUE 'conditioning';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exercises" ALTER COLUMN "meta_pattern" SET DATA TYPE text;
  DROP TYPE "public"."enum_exercises_meta_pattern";
  CREATE TYPE "public"."enum_exercises_meta_pattern" AS ENUM('vertical-pull', 'horizontal-pull', 'vertical-push', 'horizontal-push', 'squat', 'hinge', 'core', 'isolation');
  ALTER TABLE "exercises" ALTER COLUMN "meta_pattern" SET DATA TYPE "public"."enum_exercises_meta_pattern" USING "meta_pattern"::"public"."enum_exercises_meta_pattern";`)
}
