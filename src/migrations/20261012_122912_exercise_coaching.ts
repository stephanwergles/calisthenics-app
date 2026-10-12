import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "exercises_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "exercises_texts" ADD CONSTRAINT "exercises_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "exercises_texts_order_parent" ON "exercises_texts" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "exercises_texts" CASCADE;`)
}
