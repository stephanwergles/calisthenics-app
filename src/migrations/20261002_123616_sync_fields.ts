import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sessions" ADD COLUMN "set_plan" jsonb;
  ALTER TABLE "sessions" ADD COLUMN "client_updated_at" numeric;
  ALTER TABLE "activities" ADD COLUMN "client_updated_at" numeric;
  ALTER TABLE "users" ADD COLUMN "state_client_updated_at" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sessions" DROP COLUMN "set_plan";
  ALTER TABLE "sessions" DROP COLUMN "client_updated_at";
  ALTER TABLE "activities" DROP COLUMN "client_updated_at";
  ALTER TABLE "users" DROP COLUMN "state_client_updated_at";`)
}
