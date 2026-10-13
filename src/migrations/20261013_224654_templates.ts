import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_templates_equipment" AS ENUM('bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight');
  CREATE TYPE "public"."enum_templates_kind" AS ENUM('plan', 'workout');
  CREATE TYPE "public"."enum_templates_level" AS ENUM('beginner', 'intermediate', 'advanced');
  CREATE TABLE "templates_equipment" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_templates_equipment",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "templates" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_templates_kind" NOT NULL,
  	"level" "enum_templates_level" NOT NULL,
  	"days" numeric,
  	"minutes" numeric NOT NULL,
  	"description" varchar NOT NULL,
  	"workouts" jsonb NOT NULL,
  	"weekplan" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "templates_id" varchar;
  ALTER TABLE "templates_equipment" ADD CONSTRAINT "templates_equipment_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "templates_equipment_order_idx" ON "templates_equipment" USING btree ("order");
  CREATE INDEX "templates_equipment_parent_idx" ON "templates_equipment" USING btree ("parent_id");
  CREATE INDEX "templates_updated_at_idx" ON "templates" USING btree ("updated_at");
  CREATE INDEX "templates_created_at_idx" ON "templates" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_templates_fk" FOREIGN KEY ("templates_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("templates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "templates_equipment" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "templates" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "templates_equipment" CASCADE;
  DROP TABLE "templates" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_templates_fk";
  
  DROP INDEX "payload_locked_documents_rels_templates_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "templates_id";
  DROP TYPE "public"."enum_templates_equipment";
  DROP TYPE "public"."enum_templates_kind";
  DROP TYPE "public"."enum_templates_level";`)
}
