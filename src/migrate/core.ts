/* Import-Kern: v1-Export (JSON, version 3–5) → v2-Datensatz.

   Ohne Datei- oder Netzzugriff – Katalog und Positions-Tabelle werden
   übergeben. So läuft derselbe Code in Node (Skripte, Tests) und im Browser
   (Import in der Trainings-App). Deterministisch: Session-IDs sind
   `${datum}-${workout}`, ein erneuter Import überschreibt statt zu doppeln. */
import type { Catalog, Dataset, Session, Activity, SetLog } from "../domain/model.ts";
import { POSITION_HISTORY, REALITY } from "./v1-history.ts";

export interface V1Positions { workouts: string[]; slots: Record<string, string>; positions: Record<string, string> }

/** Welche Übung steckte am gegebenen Datum hinter einer v1-Position? */
export function exerciseFor(POS: V1Positions, logKey: string, date: string): { exercise: string; note?: string } | null {
  const slotKey = logKey.split("@")[0];
  const real = logKey === slotKey ? REALITY[slotKey] : undefined;
  if (real) return { exercise: real.exercise, ...(real.noteBefore && date < real.noteBefore ? { note: real.note } : {}) };
  for (const h of POSITION_HISTORY[logKey] ?? []) if (date < h.until) return { exercise: h.exercise };
  const id = POS.positions[logKey];
  return id ? { exercise: id } : null;
}

export function migrate(v1: any, CATALOG: Catalog, POS: V1Positions): { data: Dataset; warnings: string[]; dropped: string[] } {
  const warnings: string[] = [];
  const sessions = new Map<string, Session>();
  const session = (date: string, workout: string) => {
    const id = `${date}-${workout}`;
    if (!sessions.has(id)) sessions.set(id, { id, date, workout, sets: [], skipped: [], routineDone: [] });
    return sessions.get(id)!;
  };

  /* Sätze und übersprungene Übungen */
  for (const [logKey, entries] of Object.entries<any[]>(v1.log ?? {})) {
    const slotKey = logKey.split("@")[0];
    const progression = POS.slots[slotKey];
    const workout = POS.workouts[+slotKey.split("-")[0]];
    if (!progression || !workout) { warnings.push(`Unbekannter Slot ${logKey} – übersprungen`); continue; }
    for (const e of entries) {
      const values = (e.s ?? []).map((v: any, i: number) => v ? { v, i } : null).filter(Boolean);
      if (!values.length && !e.sk) continue;               // nur Satzzahl-Override, keine Historie
      const ex = exerciseFor(POS, logKey, e.d);
      if (!ex) { warnings.push(`Keine Übung für ${logKey} am ${e.d} – übersprungen`); continue; }
      const s = session(e.d, workout);
      if (e.sk && !values.length) { s.skipped.push(ex.exercise); continue; }
      for (const { v, i } of values) {
        const set: SetLog = { exercise: ex.exercise, progression, set: i + 1, value: v[0] };
        if (v[1]) set.weightKg = v[1];
        if (ex.note) set.note = ex.note;
        s.sets.push(set);
      }
    }
  }

  /* Trainingsdauer – legt auch Sessions ohne Sätze an */
  for (const [date, d] of Object.entries<any>(v1.durs ?? {})) {
    const workout = POS.workouts[d.day];
    if (!workout) { warnings.push(`Dauer am ${date}: unbekannter Tag ${d.day}`); continue; }
    session(date, workout).durationSec = Math.round(d.dur);
  }

  /* Abgehakte Warm-up-/Cool-down-Punkte: Index → Item-ID über das Workout der Session */
  for (const [date, r] of Object.entries<any>(v1.rout ?? {})) {
    const onDay = [...sessions.values()].filter(s => s.date === date);
    if (onDay.length !== 1) { warnings.push(`Routine am ${date}: ${onDay.length} Sessions, nicht zuordenbar`); continue; }
    const s = onDay[0], w = CATALOG.workouts.find(w => w.id === s.workout)!;
    for (const [key, list] of [["w", w.warmup], ["c", w.cooldown]] as const)
      for (const i of r[key] ?? []) {
        if (list[i]) s.routineDone.push(list[i].id);
        else warnings.push(`Routine am ${date}: Index ${key}${i} existiert nicht`);
      }
  }

  /* Cardio → Aktivitäten */
  const activities: Activity[] = [];
  for (const [date, list] of Object.entries<any[]>(v1.cardio ?? {}))
    list.forEach((c, i) => {
      const kind = c.t === "lauf" ? "run" : c.t === "rad" ? "ride" : null;
      if (!kind) { warnings.push(`Cardio am ${date}: unbekannte Art „${c.t}“`); return; }
      const a: Activity = { id: `${date}-${kind}-${i + 1}`, date, kind, durationMin: c.min };
      if (c.km) a.distanceKm = c.km;
      if (c.hm) a.elevationM = c.hm;
      activities.push(a);
    });

  /* Stand: aktuelle Stufe als Übungs-ID, pausierte Progressionen */
  const current: Record<string, string> = {};
  for (const p of CATALOG.progressions) current[p.id] = p.steps[0].exercise;
  for (const [slotKey, lvl] of Object.entries<number>(v1.prog ?? {})) {
    const pid = POS.slots[slotKey], id = POS.positions[lvl ? `${slotKey}@${lvl}` : slotKey];
    if (pid && id) current[pid] = id; else warnings.push(`Stand ${slotKey}@${lvl} nicht zuordenbar`);
  }
  const paused = (v1.off ?? []).map((k: string) => POS.slots[k]).filter(Boolean);

  /* Stabile Reihenfolge: Sessions nach Datum, Sätze nach Trainingsreihenfolge */
  const rank = new Map(CATALOG.workouts.flatMap(w => w.slots.map((s, i) => [s.progression, i] as const)));
  /* Tage ohne Satz und ohne Dauer waren kein Training (z. B. nur übersprungene
     Übungen im Urlaub) – sie werden verworfen und gemeldet, nicht importiert */
  const dropped: string[] = [];
  const out = [...sessions.values()].filter(s => {
    const keep = s.sets.length > 0 || s.durationSec !== undefined;
    if (!keep) dropped.push(s.id);
    return keep;
  }).sort((a, b) => a.id < b.id ? -1 : 1);
  for (const s of out)
    s.sets.sort((a, b) => (rank.get(a.progression)! - rank.get(b.progression)!) || a.set - b.set);

  return {
    warnings, dropped,
    data: {
      schema: 1,
      source: { app: "v1", exportVersion: v1.version ?? null, exportedAt: v1.exported ?? null },
      sessions: out,
      activities: activities.sort((a, b) => a.id < b.id ? -1 : 1),
      state: { current, paused },
    },
  };
}
