/* Import in Node: v1-Export (JSON, version 3–5) → v2-Datensatz.

     node src/migrate/from-v1.ts <v1-export.json> [ausgabe.json]

   Liest Katalog und Positions-Tabelle von der Platte und ruft den Kern
   (core.ts) auf, den auch der Browser-Import nutzt. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../domain/model.ts";
import * as core from "./core.ts";

const here = new URL("./", import.meta.url);
const POS: core.V1Positions = JSON.parse(readFileSync(new URL("v1-positions.json", here), "utf8"));
const CATALOG: Catalog = JSON.parse(readFileSync(new URL("../seed/catalog.json", here), "utf8"));

export const exerciseFor = (logKey: string, date: string) => core.exerciseFor(POS, logKey, date);
export const migrate = (v1: any) => core.migrate(v1, CATALOG, POS);

/* CLI */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , input, output] = process.argv;
  if (!input) { console.error("Aufruf: node src/migrate/from-v1.ts <v1-export.json> [ausgabe.json]"); process.exit(1); }
  const { data, warnings, dropped } = migrate(JSON.parse(readFileSync(input, "utf8")));
  const sets = data.sessions.reduce((a, s) => a + s.sets.length, 0);
  console.log(`${data.sessions.length} Sessions · ${sets} Sätze · ${data.activities.length} Aktivitäten · ${warnings.length} Warnungen`);
  if (dropped.length) console.log(`  · ${dropped.length} leere Tage verworfen (kein Satz, keine Dauer): ${dropped.join(", ")}`);
  warnings.forEach(w => console.log("  ! " + w));
  if (output) writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
}
