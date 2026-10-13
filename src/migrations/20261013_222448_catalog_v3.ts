import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_exercises_meta_alternatives_items" AS ENUM('bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'floor', 'wall');
  CREATE TYPE "public"."enum_exercises_meta_pattern" AS ENUM('vertical-pull', 'horizontal-pull', 'vertical-push', 'horizontal-push', 'squat', 'hinge', 'core', 'isolation');
  CREATE TYPE "public"."enum_splits_themes_regions" AS ENUM('pull', 'push', 'core', 'legs');
  CREATE TYPE "public"."enum_assessment_tests_unit" AS ENUM('reps', 'seconds', 'level');
  CREATE TABLE "exercises_meta_alternatives_items" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_exercises_meta_alternatives_items",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "exercises_meta_alternatives" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "progressions_numbers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric,
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL
  );
  
  CREATE TABLE "skills_prerequisites" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"progression_id" varchar NOT NULL,
  	"min_step" numeric NOT NULL
  );
  
  CREATE TABLE "skills" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "skills_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"progressions_id" varchar
  );
  
  CREATE TABLE "splits_themes_regions" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_splits_themes_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "splits_themes" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "splits" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "assessment_tests" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"unit" "enum_assessment_tests_unit" NOT NULL
  );
  
  CREATE TABLE "assessment" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "assessment_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "exercises" ADD COLUMN "meta_pattern" "enum_exercises_meta_pattern";
  ALTER TABLE "exercises" ADD COLUMN "meta_difficulty" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_wrist" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_elbow" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_shoulder" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_stress_knee" numeric;
  ALTER TABLE "exercises" ADD COLUMN "meta_unsure" varchar;
  ALTER TABLE "progressions" ADD COLUMN "assessment_test" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "skills_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "splits_id" varchar;
  ALTER TABLE "exercises_meta_alternatives_items" ADD CONSTRAINT "exercises_meta_alternatives_items_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exercises_meta_alternatives"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "exercises_meta_alternatives" ADD CONSTRAINT "exercises_meta_alternatives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "progressions_numbers" ADD CONSTRAINT "progressions_numbers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."progressions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "skills_prerequisites" ADD CONSTRAINT "skills_prerequisites_progression_id_progressions_id_fk" FOREIGN KEY ("progression_id") REFERENCES "public"."progressions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "skills_prerequisites" ADD CONSTRAINT "skills_prerequisites_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "skills_rels" ADD CONSTRAINT "skills_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "skills_rels" ADD CONSTRAINT "skills_rels_progressions_fk" FOREIGN KEY ("progressions_id") REFERENCES "public"."progressions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "splits_themes_regions" ADD CONSTRAINT "splits_themes_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."splits_themes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "splits_themes" ADD CONSTRAINT "splits_themes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assessment_tests" ADD CONSTRAINT "assessment_tests_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "assessment_texts" ADD CONSTRAINT "assessment_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assessment"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "exercises_meta_alternatives_items_order_idx" ON "exercises_meta_alternatives_items" USING btree ("order");
  CREATE INDEX "exercises_meta_alternatives_items_parent_idx" ON "exercises_meta_alternatives_items" USING btree ("parent_id");
  CREATE INDEX "exercises_meta_alternatives_order_idx" ON "exercises_meta_alternatives" USING btree ("_order");
  CREATE INDEX "exercises_meta_alternatives_parent_id_idx" ON "exercises_meta_alternatives" USING btree ("_parent_id");
  CREATE INDEX "progressions_numbers_order_parent_idx" ON "progressions_numbers" USING btree ("order","parent_id");
  CREATE INDEX "skills_prerequisites_order_idx" ON "skills_prerequisites" USING btree ("_order");
  CREATE INDEX "skills_prerequisites_parent_id_idx" ON "skills_prerequisites" USING btree ("_parent_id");
  CREATE INDEX "skills_prerequisites_progression_idx" ON "skills_prerequisites" USING btree ("progression_id");
  CREATE INDEX "skills_updated_at_idx" ON "skills" USING btree ("updated_at");
  CREATE INDEX "skills_created_at_idx" ON "skills" USING btree ("created_at");
  CREATE INDEX "skills_rels_order_idx" ON "skills_rels" USING btree ("order");
  CREATE INDEX "skills_rels_parent_idx" ON "skills_rels" USING btree ("parent_id");
  CREATE INDEX "skills_rels_path_idx" ON "skills_rels" USING btree ("path");
  CREATE INDEX "skills_rels_progressions_id_idx" ON "skills_rels" USING btree ("progressions_id");
  CREATE INDEX "splits_themes_regions_order_idx" ON "splits_themes_regions" USING btree ("order");
  CREATE INDEX "splits_themes_regions_parent_idx" ON "splits_themes_regions" USING btree ("parent_id");
  CREATE INDEX "splits_themes_order_idx" ON "splits_themes" USING btree ("_order");
  CREATE INDEX "splits_themes_parent_id_idx" ON "splits_themes" USING btree ("_parent_id");
  CREATE INDEX "splits_updated_at_idx" ON "splits" USING btree ("updated_at");
  CREATE INDEX "splits_created_at_idx" ON "splits" USING btree ("created_at");
  CREATE INDEX "assessment_tests_order_idx" ON "assessment_tests" USING btree ("_order");
  CREATE INDEX "assessment_tests_parent_id_idx" ON "assessment_tests" USING btree ("_parent_id");
  CREATE INDEX "assessment_texts_order_parent" ON "assessment_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_skills_fk" FOREIGN KEY ("skills_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_splits_fk" FOREIGN KEY ("splits_id") REFERENCES "public"."splits"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_skills_id_idx" ON "payload_locked_documents_rels" USING btree ("skills_id");
  CREATE INDEX "payload_locked_documents_rels_splits_id_idx" ON "payload_locked_documents_rels" USING btree ("splits_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exercises_meta_alternatives_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "exercises_meta_alternatives" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "progressions_numbers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "skills_prerequisites" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "skills" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "skills_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "splits_themes_regions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "splits_themes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "splits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assessment_tests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assessment" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "assessment_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "exercises_meta_alternatives_items" CASCADE;
  DROP TABLE "exercises_meta_alternatives" CASCADE;
  DROP TABLE "progressions_numbers" CASCADE;
  DROP TABLE "skills_prerequisites" CASCADE;
  DROP TABLE "skills" CASCADE;
  DROP TABLE "skills_rels" CASCADE;
  DROP TABLE "splits_themes_regions" CASCADE;
  DROP TABLE "splits_themes" CASCADE;
  DROP TABLE "splits" CASCADE;
  DROP TABLE "assessment_tests" CASCADE;
  DROP TABLE "assessment" CASCADE;
  DROP TABLE "assessment_texts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_skills_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_splits_fk";
  
  DROP INDEX "payload_locked_documents_rels_skills_id_idx";
  DROP INDEX "payload_locked_documents_rels_splits_id_idx";
  ALTER TABLE "exercises" DROP COLUMN "meta_pattern";
  ALTER TABLE "exercises" DROP COLUMN "meta_difficulty";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_wrist";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_elbow";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_shoulder";
  ALTER TABLE "exercises" DROP COLUMN "meta_stress_knee";
  ALTER TABLE "exercises" DROP COLUMN "meta_unsure";
  ALTER TABLE "progressions" DROP COLUMN "assessment_test";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "skills_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "splits_id";
  DROP TYPE "public"."enum_exercises_meta_alternatives_items";
  DROP TYPE "public"."enum_exercises_meta_pattern";
  DROP TYPE "public"."enum_splits_themes_regions";
  DROP TYPE "public"."enum_assessment_tests_unit";`)
}
