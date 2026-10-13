import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('athlete', 'admin');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'athlete' NOT NULL;`)
  // Bisher gab es nur die Person, die die App betreibt – das älteste Konto wird Admin
  // (bewusst keine E-Mail-Adresse im öffentlichen Repo)
  await db.execute(sql`UPDATE "users" SET "role" = 'admin' WHERE "id" = (SELECT min("id") FROM "users");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "role";
  DROP TYPE "public"."enum_users_role";`)
}
