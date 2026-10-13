import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_plans_source" AS ENUM('catalog', 'generated', 'custom');
  CREATE TABLE "plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"version" numeric DEFAULT 1 NOT NULL,
  	"source" "enum_plans_source" DEFAULT 'custom' NOT NULL,
  	"workouts" jsonb NOT NULL,
  	"weekplan" jsonb NOT NULL,
  	"inputs" jsonb,
  	"client_updated_at" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "sessions" ALTER COLUMN "workout_id" DROP NOT NULL;
  ALTER TABLE "sessions" ADD COLUMN "workout_key" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "plans_id" integer;
  ALTER TABLE "plans" ADD CONSTRAINT "plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "plans_user_idx" ON "plans" USING btree ("user_id");
  CREATE INDEX "plans_key_idx" ON "plans" USING btree ("key");
  CREATE INDEX "plans_updated_at_idx" ON "plans" USING btree ("updated_at");
  CREATE INDEX "plans_created_at_idx" ON "plans" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plans_fk" FOREIGN KEY ("plans_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sessions_workout_key_idx" ON "sessions" USING btree ("workout_key");
  CREATE INDEX "payload_locked_documents_rels_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("plans_id");`)
  // bestehende Einheiten: Plan-Schlüssel = bisheriges Katalog-Workout
  await db.execute(sql`UPDATE "sessions" SET "workout_key" = "workout_id" WHERE "workout_key" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "plans" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "plans" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_plans_fk";
  
  DROP INDEX "sessions_workout_key_idx";
  DROP INDEX "payload_locked_documents_rels_plans_id_idx";
  ALTER TABLE "sessions" ALTER COLUMN "workout_id" SET NOT NULL;
  ALTER TABLE "sessions" DROP COLUMN "workout_key";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "plans_id";
  DROP TYPE "public"."enum_plans_source";`)
}
