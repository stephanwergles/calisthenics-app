/* node --test test/migrate.test.ts
   Läuft mit erfundenen Daten – echte Trainingsexporte gehören nicht ins öffentliche Repo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { migrate, exerciseFor } from "../src/migrate/from-v1.ts";
import { POSITION_HISTORY, REALITY } from "../src/migrate/v1-history.ts";
import type { Catalog } from "../src/domain/model.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const catalog: Catalog = read("../src/seed/catalog.json");
const positions = read("../src/migrate/v1-positions.json");
const fixture = read("./fixture-v1.json");
const { data, warnings, dropped } = migrate(fixture);
const sess = (id: string) => data.sessions.find(s => s.id === id)!;
const on = (id: string, ex: string) => sess(id).sets.filter(s => s.exercise === ex);

test("Katalog: IDs eindeutig, alle Verweise lösen auf", () => {
  const ex = new Set(catalog.exercises.map(e => e.id));
  const pr = new Set(catalog.progressions.map(p => p.id));
  assert.equal(ex.size, catalog.exercises.length, "doppelte Übungs-ID");
  assert.equal(pr.size, catalog.progressions.length, "doppelte Progressions-ID");
  for (const p of catalog.progressions) for (const s of p.steps) assert.ok(ex.has(s.exercise), s.exercise);
  const used = catalog.workouts.flatMap(w => w.slots.map(s => s.progression));
  assert.deepEqual([...used].sort(), [...pr].sort(), "jede Progression genau einmal im Plan");
  for (const w of Object.values(catalog.weekplan)) assert.ok(catalog.workouts.some(x => x.id === w), w);
  const items = catalog.workouts.flatMap(w => [...w.warmup, ...w.cooldown].map(i => i.id));
  assert.equal(new Set(items).size, items.length, "doppelte Routine-ID");
});

test("Übersetzungstabellen zeigen nur auf existierende Übungen", () => {
  const ex = new Set(catalog.exercises.map(e => e.id));
  for (const id of Object.values<string>(positions.positions)) assert.ok(ex.has(id), id);
  for (const list of Object.values(POSITION_HISTORY)) for (const h of list) assert.ok(ex.has(h.exercise), h.exercise);
  for (const r of Object.values(REALITY)) assert.ok(ex.has(r.exercise), r.exercise);
});

test("Positionen mit Bedeutungswechsel werden nach Datum aufgelöst", () => {
  assert.equal(exerciseFor("0-0@1", "2026-08-01")!.exercise, "muscle-up");
  assert.equal(exerciseFor("0-0@1", "2026-08-20")!.exercise, "muscle-up-band");
  assert.equal(exerciseFor("0-0@1", "2026-09-30")!.exercise, "chest-to-bar-pull-up");
  assert.equal(exerciseFor("0-5", "2026-07-26")!.exercise, "archer-pull-up");
  assert.equal(exerciseFor("0-5", "2026-09-30")!.exercise, "uneven-pull-up");
  assert.equal(exerciseFor("1-7", "2026-09-28")!.exercise, "handstand-wall");
});

test("Band-Muscle-up: alte Zählweise wird markiert, ehrliche nicht", () => {
  assert.match(on("2026-09-21-pull", "muscle-up-band")[0].note!, /Fußabstoß/);
  assert.equal(on("2026-09-30-pull", "muscle-up-band")[0].note, undefined);
});

test("Sätze: Nummerierung mit Lücken, Gewicht, Reihenfolge wie im Training", () => {
  assert.deepEqual(on("2026-09-30-pull", "chest-to-bar-pull-up").map(s => s.set), [1, 2, 4]);
  assert.deepEqual(on("2026-09-30-pull", "pull-up").map(s => s.weightKg), [5, 5]);
  const order = sess("2026-09-30-pull").sets.map(s => s.progression);
  assert.ok(order.indexOf("muscle-up-pull") < order.indexOf("pull-up"));
  assert.ok(order.indexOf("pull-up") < order.indexOf("one-arm-pull"), "ord 3.5 bleibt erhalten");
});

test("Übersprungenes, Satzzahl-Overrides, leere Tage", () => {
  assert.deepEqual(sess("2026-09-30-pull").skipped, ["body-row"]);
  assert.deepEqual(dropped, ["2026-08-25-pull"]);
  assert.equal(on("2026-09-28-push", "pseudo-planche-push-up").length, 0, "nur n = keine Historie");
});

test("Dauer, Routine, Cardio, Stand", () => {
  assert.equal(sess("2026-09-30-pull").durationSec, 4189);
  assert.deepEqual(sess("2026-09-30-pull").routineDone,
    ["pull-warm-armkreisen", "pull-warm-band-pull-aparts", "pull-cool-cardio-locker"]);
  assert.deepEqual(data.activities.map(a => [a.kind, a.distanceKm ?? null]), [["ride", 40], ["run", null]]);
  assert.equal(data.state.current["muscle-up-pull"], "chest-to-bar-pull-up");
  assert.equal(data.state.current["l-sit"], "l-sit-parallettes");
  assert.equal(data.state.current["pistol"], "pistol-squat-assisted", "ohne Freischaltung = erste Stufe");
  assert.deepEqual(data.state.paused, ["one-arm-pull"]);
});

test("Warnungen statt stiller Fehler", () => {
  assert.ok(warnings.some(w => w.includes("9-9")), "unbekannter Slot");
  assert.ok(warnings.some(w => w.includes("c9")), "Routine-Index außerhalb");
  assert.equal(warnings.length, 2);
});

test("Deterministisch: zweimal importieren ergibt dasselbe", () => {
  assert.deepEqual(migrate(structuredClone(fixture)).data, data);
});
