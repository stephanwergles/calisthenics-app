/* Einmal-Werkzeug: erzeugt den v2-Katalog aus dem aktuellen v1-Plan.

     node v2/tools/extract-catalog.ts

   Schreibt v2/catalog/catalog.json (ab dann die Quelle der Wahrheit für den
   Katalog) und v2/migrate/v1-positions.json (Übersetzungstabelle für den Import).
   Die IDs stehen unten von Hand – bewusst nicht aus Namen generiert, damit eine
   spätere Umbenennung nie eine ID verändert. Läuft das Skript erneut, prüft es,
   dass keine bestehende ID verschwindet. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Catalog, Exercise, Progression, Workout, RoutineItem, Block, Weekday } from "../model.ts";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const grab = (start: string, end: string) => {
  const i = html.indexOf(start);
  if (i < 0) throw new Error(`nicht gefunden: ${start}`);
  return html.slice(i, html.indexOf(end, i) + end.length);
};
const PLAN = new Function(grab("const PLAN = [", "\n];").replace("const PLAN =", "return"))();
const ROUTINES = new Function(grab("const ROUTINES = [", "\n];").replace("const ROUTINES =", "return"))();
const WEEKPLAN = new Function(grab("const WEEKPLAN = {", "};").replace("const WEEKPLAN =", "return"))();

/* Übungs-IDs, Schlüssel = v1-Name */
const EXERCISE_IDS: Record<string, string> = {
  "Explosive Klimmzüge": "explosive-pull-up",
  "Chest-to-Bar Klimmzüge": "chest-to-bar-pull-up",
  "Muscle-up (Stange)": "muscle-up",
  "Straight Bar Dips": "straight-bar-dip",
  "Russian Dips (Barren)": "russian-dip",
  "Muscle-up mit Band": "muscle-up-band",
  "Negative Muscle-ups": "muscle-up-negative",
  "Klimmzüge (volle ROM)": "pull-up",
  "Klimmzüge mit Zusatzgewicht": "pull-up-weighted",
  "Body Rows": "body-row",
  "Tuck Front Lever Rows": "tuck-front-lever-row",
  "Uneven Pull-ups (Handtuch)": "uneven-pull-up",
  "Archer Pull-ups": "archer-pull-up",
  "Typewriter Pull-ups": "typewriter-pull-up",
  "Hanging Scapula Shrugs": "scapula-shrug",
  "Bizeps-Curls (Stange oder Band)": "biceps-curl",
  "L-Sit (Boden)": "l-sit-floor",
  "L-Sit (Parallettes)": "l-sit-parallettes",
  "L-Sit Pull-Throughs / V-Sit-Anbahnung": "v-sit-prep",
  "Pseudo Planche Push-ups": "pseudo-planche-push-up",
  "PPPU Füße erhöht": "pseudo-planche-push-up-elevated",
  "Tuck Planche Hold": "tuck-planche",
  "Dips (tief)": "dip",
  "Dips mit Zusatzgewicht": "dip-weighted",
  "Pike Push-ups": "pike-push-up",
  "Pike Push-ups, Füße erhöht": "pike-push-up-elevated",
  "Wand-Handstand Push-ups": "handstand-push-up-wall",
  "Liegestütze, Füße erhöht": "decline-push-up",
  "Ring Push-ups": "ring-push-up",
  "Ring- / Band-Flys": "fly",
  "Trizeps-Extensions": "triceps-extension",
  "Wall Handstand (Bauch zur Wand)": "handstand-wall",
  "Heel Pulls (von der Wand lösen)": "handstand-heel-pull",
  "Freier Handstand": "handstand-free",
  "Pistol-Squat (assistiert)": "pistol-squat-assisted",
  "Pistol-Squat (frei)": "pistol-squat",
  "Pistol-Squat mit Gewicht": "pistol-squat-weighted",
  "Bulgarian Split Squats": "bulgarian-split-squat",
  "Nordic Curl Negative": "nordic-curl-negative",
  "Nordic Curl (Band-assistiert konzentrisch)": "nordic-curl-band",
  "Wadenheben, einbeinig": "calf-raise-single-leg",
  "Hanging Leg Raises": "hanging-leg-raise",
  "Toes to Bar": "toes-to-bar",
  "Hollow Body Hold": "hollow-hold",
  "Hollow Body Rocks": "hollow-rock",
  "Side Plank + Rotation": "side-plank-rotation",
  "Dead Hang": "dead-hang",
};

/* Progressions-IDs, Schlüssel = v1-Slot (Tag-Slot) */
const PROGRESSION_IDS: Record<string, string> = {
  "0-0": "muscle-up-pull", "0-1": "bar-dip", "0-2": "muscle-up-transition", "0-3": "pull-up",
  "0-4": "row", "0-5": "one-arm-pull", "0-6": "scapula", "0-7": "biceps",
  "1-0": "l-sit", "1-1": "planche", "1-2": "dip", "1-3": "vertical-push",
  "1-4": "horizontal-push", "1-5": "fly", "1-6": "triceps", "1-7": "handstand",
  "2-0": "pistol", "2-1": "split-squat", "2-2": "nordic", "2-3": "calf",
  "2-4": "leg-raise", "2-5": "hollow", "2-6": "side-plank", "2-7": "hang",
};
const WORKOUT_IDS = ["pull", "push", "legs"];
const BLOCKS: Record<string, Block> = { Skill: "skill", Kraft: "strength", Core: "core", "Zubehör": "accessory", Extra: "extra" };
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const slug = (s: string) => s.toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function target(l: any) {
  const m = String(l.reps).match(/×\s*(\d+)(?:–(\d+))?/);
  return {
    label: l.reps, sets: parseInt(l.reps, 10),
    ...(m ? { min: +m[1], max: +(m[2] ?? m[1]) } : {}),
    restSec: l.rest, unlockAt: l.up ?? null,
  };
}

const exercises = new Map<string, Exercise>();
const progressions: Progression[] = [];
const positions: Record<string, string> = {};
const slots: Record<string, string> = {};

const workouts: Workout[] = PLAN.map((day: any, di: number) => {
  const order = day.slots.map((_: any, si: number) => si)
    .sort((a: number, b: number) => (day.slots[a].ord ?? a) - (day.slots[b].ord ?? b));
  const routine = (list: any[], kind: string): RoutineItem[] => list.map(it => ({
    id: `${WORKOUT_IDS[di]}-${kind}-${slug(it.n)}`, name: it.n, detail: it.d, ...(it.cardio ? { cardio: true } : {}),
  }));
  day.slots.forEach((s: any, si: number) => {
    const pid = PROGRESSION_IDS[`${di}-${si}`];
    if (!pid) throw new Error(`Keine Progressions-ID für Slot ${di}-${si}`);
    slots[`${di}-${si}`] = pid;
    progressions.push({ id: pid, steps: s.levels.map((l: any, lvl: number) => {
      const id = EXERCISE_IDS[l.name];
      if (!id) throw new Error(`Keine Übungs-ID für „${l.name}“`);
      positions[lvl ? `${di}-${si}@${lvl}` : `${di}-${si}`] = id;
      if (!exercises.has(id)) exercises.set(id, {
        id, name: l.name, unit: l.opts?.t ? "seconds" : "reps", weighted: !!l.opts?.w,
        perSide: /Seite/.test(l.reps),
        technique: { setup: l.pos, execution: l.exec, faults: l.fehler, scaling: l.reg ?? "" },
        media: { sketch: l.svg, videoQuery: l.query },
      });
      return { exercise: id, target: target(l) };
    }) });
  });
  return {
    id: WORKOUT_IDS[di], name: day.name, focus: day.sub,
    slots: order.map((si: number) => ({ block: BLOCKS[day.slots[si].block], progression: PROGRESSION_IDS[`${di}-${si}`] })),
    warmup: routine(ROUTINES[di].warm, "warm"), cooldown: routine(ROUTINES[di].cool, "cool"),
  };
});

const weekplan: Catalog["weekplan"] = {};
Object.entries(WEEKPLAN).forEach(([wd, di]) => { weekplan[WEEKDAYS[+wd]] = WORKOUT_IDS[di as number]; });

const catalog: Catalog = { schema: 1, exercises: [...exercises.values()], progressions, workouts, weekplan };

/* Schutz: eine erneute Ausführung darf keine bestehende ID entfernen */
const catalogFile = new URL("catalog/catalog.json", new URL("../", import.meta.url));
if (existsSync(catalogFile)) {
  const old: Catalog = JSON.parse(readFileSync(catalogFile, "utf8"));
  const now = new Set(catalog.exercises.map(e => e.id));
  const lost = old.exercises.map(e => e.id).filter(id => !now.has(id));
  if (lost.length) throw new Error(`IDs würden verschwinden: ${lost.join(", ")}`);
}
writeFileSync(catalogFile, JSON.stringify(catalog, null, 2) + "\n");
writeFileSync(new URL("migrate/v1-positions.json", new URL("../", import.meta.url)),
  JSON.stringify({ workouts: WORKOUT_IDS, slots, positions }, null, 2) + "\n");
console.log(`Katalog: ${catalog.exercises.length} Übungen, ${progressions.length} Progressionen, ${workouts.length} Workouts`);
