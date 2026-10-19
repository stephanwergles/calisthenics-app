import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_exercises_meta_alternatives_items" ADD VALUE 'ab-wheel' BEFORE 'floor';
  ALTER TYPE "public"."enum_templates_equipment" ADD VALUE 'ab-wheel';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exercises_meta_alternatives_items" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_exercises_meta_alternatives_items";
  CREATE TYPE "public"."enum_exercises_meta_alternatives_items" AS ENUM('bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'pole', 'floor', 'wall');
  ALTER TABLE "exercises_meta_alternatives_items" ALTER COLUMN "value" SET DATA TYPE "public"."enum_exercises_meta_alternatives_items" USING "value"::"public"."enum_exercises_meta_alternatives_items";
  ALTER TABLE "templates_equipment" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_templates_equipment";
  CREATE TYPE "public"."enum_templates_equipment" AS ENUM('bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'pole');
  ALTER TABLE "templates_equipment" ALTER COLUMN "value" SET DATA TYPE "public"."enum_templates_equipment" USING "value"::"public"."enum_templates_equipment";`)
}
