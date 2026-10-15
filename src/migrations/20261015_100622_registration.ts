import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "apple_sub" varchar;
  ALTER TABLE "users" ADD COLUMN "_verified" boolean;
  ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  CREATE UNIQUE INDEX "users_apple_sub_idx" ON "users" USING btree ("apple_sub");`)
  // Bestehende Konten gelten als bestätigt – sonst sperrt die neue Mail-Bestätigung sie aus
  await db.execute(sql`UPDATE "users" SET "_verified" = true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_apple_sub_idx";
  ALTER TABLE "users" DROP COLUMN "apple_sub";
  ALTER TABLE "users" DROP COLUMN "_verified";
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";`)
}
