import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activities_kind" AS ENUM('run', 'ride', 'workout');
  CREATE TYPE "public"."enum_exercises_unit" AS ENUM('reps', 'seconds');
  CREATE TYPE "public"."enum_workouts_slots_block" AS ENUM('skill', 'strength', 'core', 'accessory', 'extra');
  CREATE TABLE "sessions_sets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar NOT NULL,
  	"progression_id" varchar,
  	"set" numeric NOT NULL,
  	"value" numeric NOT NULL,
  	"weight_kg" numeric,
  	"attempts" numeric,
  	"note" varchar
  );
  
  CREATE TABLE "sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"date" varchar NOT NULL,
  	"workout_id" varchar NOT NULL,
  	"duration_sec" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sessions_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "sessions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"exercises_id" varchar
  );
  
  CREATE TABLE "activities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"date" varchar NOT NULL,
  	"kind" "enum_activities_kind" NOT NULL,
  	"name" varchar,
  	"duration_min" numeric,
  	"distance_km" numeric,
  	"elevation_m" numeric,
  	"rounds" numeric,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "exercises" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"unit" "enum_exercises_unit" DEFAULT 'reps' NOT NULL,
  	"weighted" boolean,
  	"per_side" boolean,
  	"technique_setup" varchar,
  	"technique_execution" varchar,
  	"technique_faults" varchar,
  	"technique_scaling" varchar,
  	"media_sketch" varchar,
  	"media_video_query" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "progressions_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"exercise_id" varchar NOT NULL,
  	"target_label" varchar NOT NULL,
  	"target_sets" numeric NOT NULL,
  	"target_min" numeric,
  	"target_max" numeric,
  	"target_rest_sec" numeric NOT NULL,
  	"target_unlock_at" numeric
  );
  
  CREATE TABLE "progressions" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "workouts_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block" "enum_workouts_slots_block" NOT NULL,
  	"progression_id" varchar NOT NULL
  );
  
  CREATE TABLE "workouts_warmup" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"detail" varchar,
  	"cardio" boolean
  );
  
  CREATE TABLE "workouts_cooldown" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"detail" varchar,
  	"cardio" boolean
  );
  
  CREATE TABLE "workouts" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"focus" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"state_current" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"progressions_id" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"sessions_id" integer,
  	"activities_id" integer,
  	"exercises_id" varchar,
  	"progressions_id" varchar,
  	"workouts_id" varchar,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "weekplan" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mon_id" varchar,
  	"tue_id" varchar,
  	"wed_id" varchar,
  	"thu_id" varchar,
  	"fri_id" varchar,
  	"sat_id" varchar,
  	"sun_id" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "sessions_sets" ADD CONSTRAINT "sessions_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions_sets" ADD CONSTRAINT "sessions_sets_progression_id_progressions_id_fk" FOREIGN KEY ("progression_id") REFERENCES "public"."progressions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions_sets" ADD CONSTRAINT "sessions_sets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions_texts" ADD CONSTRAINT "sessions_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_rels" ADD CONSTRAINT "sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_rels" ADD CONSTRAINT "sessions_rels_exercises_fk" FOREIGN KEY ("exercises_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "progressions_steps" ADD CONSTRAINT "progressions_steps_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "progressions_steps" ADD CONSTRAINT "progressions_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."progressions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workouts_slots" ADD CONSTRAINT "workouts_slots_progression_id_progressions_id_fk" FOREIGN KEY ("progression_id") REFERENCES "public"."progressions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "workouts_slots" ADD CONSTRAINT "workouts_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workouts_warmup" ADD CONSTRAINT "workouts_warmup_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workouts_cooldown" ADD CONSTRAINT "workouts_cooldown_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_progressions_fk" FOREIGN KEY ("progressions_id") REFERENCES "public"."progressions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_exercises_fk" FOREIGN KEY ("exercises_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_progressions_fk" FOREIGN KEY ("progressions_id") REFERENCES "public"."progressions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workouts_fk" FOREIGN KEY ("workouts_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_mon_id_workouts_id_fk" FOREIGN KEY ("mon_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_tue_id_workouts_id_fk" FOREIGN KEY ("tue_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_wed_id_workouts_id_fk" FOREIGN KEY ("wed_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_thu_id_workouts_id_fk" FOREIGN KEY ("thu_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_fri_id_workouts_id_fk" FOREIGN KEY ("fri_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_sat_id_workouts_id_fk" FOREIGN KEY ("sat_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "weekplan" ADD CONSTRAINT "weekplan_sun_id_workouts_id_fk" FOREIGN KEY ("sun_id") REFERENCES "public"."workouts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sessions_sets_order_idx" ON "sessions_sets" USING btree ("_order");
  CREATE INDEX "sessions_sets_parent_id_idx" ON "sessions_sets" USING btree ("_parent_id");
  CREATE INDEX "sessions_sets_exercise_idx" ON "sessions_sets" USING btree ("exercise_id");
  CREATE INDEX "sessions_sets_progression_idx" ON "sessions_sets" USING btree ("progression_id");
  CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
  CREATE INDEX "sessions_key_idx" ON "sessions" USING btree ("key");
  CREATE INDEX "sessions_date_idx" ON "sessions" USING btree ("date");
  CREATE INDEX "sessions_workout_idx" ON "sessions" USING btree ("workout_id");
  CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE INDEX "sessions_texts_order_parent" ON "sessions_texts" USING btree ("order","parent_id");
  CREATE INDEX "sessions_rels_order_idx" ON "sessions_rels" USING btree ("order");
  CREATE INDEX "sessions_rels_parent_idx" ON "sessions_rels" USING btree ("parent_id");
  CREATE INDEX "sessions_rels_path_idx" ON "sessions_rels" USING btree ("path");
  CREATE INDEX "sessions_rels_exercises_id_idx" ON "sessions_rels" USING btree ("exercises_id");
  CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id");
  CREATE INDEX "activities_key_idx" ON "activities" USING btree ("key");
  CREATE INDEX "activities_date_idx" ON "activities" USING btree ("date");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "exercises_updated_at_idx" ON "exercises" USING btree ("updated_at");
  CREATE INDEX "exercises_created_at_idx" ON "exercises" USING btree ("created_at");
  CREATE INDEX "progressions_steps_order_idx" ON "progressions_steps" USING btree ("_order");
  CREATE INDEX "progressions_steps_parent_id_idx" ON "progressions_steps" USING btree ("_parent_id");
  CREATE INDEX "progressions_steps_exercise_idx" ON "progressions_steps" USING btree ("exercise_id");
  CREATE INDEX "progressions_updated_at_idx" ON "progressions" USING btree ("updated_at");
  CREATE INDEX "progressions_created_at_idx" ON "progressions" USING btree ("created_at");
  CREATE INDEX "workouts_slots_order_idx" ON "workouts_slots" USING btree ("_order");
  CREATE INDEX "workouts_slots_parent_id_idx" ON "workouts_slots" USING btree ("_parent_id");
  CREATE INDEX "workouts_slots_progression_idx" ON "workouts_slots" USING btree ("progression_id");
  CREATE INDEX "workouts_warmup_order_idx" ON "workouts_warmup" USING btree ("_order");
  CREATE INDEX "workouts_warmup_parent_id_idx" ON "workouts_warmup" USING btree ("_parent_id");
  CREATE INDEX "workouts_cooldown_order_idx" ON "workouts_cooldown" USING btree ("_order");
  CREATE INDEX "workouts_cooldown_parent_id_idx" ON "workouts_cooldown" USING btree ("_parent_id");
  CREATE INDEX "workouts_updated_at_idx" ON "workouts" USING btree ("updated_at");
  CREATE INDEX "workouts_created_at_idx" ON "workouts" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_progressions_id_idx" ON "users_rels" USING btree ("progressions_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_exercises_id_idx" ON "payload_locked_documents_rels" USING btree ("exercises_id");
  CREATE INDEX "payload_locked_documents_rels_progressions_id_idx" ON "payload_locked_documents_rels" USING btree ("progressions_id");
  CREATE INDEX "payload_locked_documents_rels_workouts_id_idx" ON "payload_locked_documents_rels" USING btree ("workouts_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "weekplan_mon_idx" ON "weekplan" USING btree ("mon_id");
  CREATE INDEX "weekplan_tue_idx" ON "weekplan" USING btree ("tue_id");
  CREATE INDEX "weekplan_wed_idx" ON "weekplan" USING btree ("wed_id");
  CREATE INDEX "weekplan_thu_idx" ON "weekplan" USING btree ("thu_id");
  CREATE INDEX "weekplan_fri_idx" ON "weekplan" USING btree ("fri_id");
  CREATE INDEX "weekplan_sat_idx" ON "weekplan" USING btree ("sat_id");
  CREATE INDEX "weekplan_sun_idx" ON "weekplan" USING btree ("sun_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "sessions_sets" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "sessions_texts" CASCADE;
  DROP TABLE "sessions_rels" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "exercises" CASCADE;
  DROP TABLE "progressions_steps" CASCADE;
  DROP TABLE "progressions" CASCADE;
  DROP TABLE "workouts_slots" CASCADE;
  DROP TABLE "workouts_warmup" CASCADE;
  DROP TABLE "workouts_cooldown" CASCADE;
  DROP TABLE "workouts" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "weekplan" CASCADE;
  DROP TYPE "public"."enum_activities_kind";
  DROP TYPE "public"."enum_exercises_unit";
  DROP TYPE "public"."enum_workouts_slots_block";`)
}
