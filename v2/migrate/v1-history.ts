/* Wann bedeutete eine v1-Position etwas anderes als heute?

   Belegt durch die Git-Historie von index.html (Commit in Klammern). `until`
   ist exklusiv: Einträge mit Datum < until gehören zur genannten Übung, ab dann
   gilt v1-positions.json. Positionen ohne Eintrag hier hatten immer dieselbe
   Bedeutung (reine Umbenennungen wie die Bizeps-Curls zählen nicht). */
export const POSITION_HISTORY: Record<string, { until: string; exercise: string }[]> = {
  "0-5":   [{ until: "2026-07-27", exercise: "archer-pull-up" }],      // ee95d6f: Uneven davor
  "0-5@1": [{ until: "2026-07-27", exercise: "typewriter-pull-up" }],  // ee95d6f
  "0-0@1": [
    { until: "2026-08-10", exercise: "muscle-up" },                    // 35e3a38: Band-Stufe eingefügt
    { until: "2026-09-22", exercise: "muscle-up-band" },               // b7b9fc6: Chest-to-Bar
  ],
};

/* Wo die Realität vom App-Text abwich – nach Aussage des Nutzers.
   Slot 0-2 hieß bis 22.09.2026 „Muscle-up-Transition (unterstützt)“, trainiert
   wurde aber von Anfang an der Muscle-up im Band. Bis 29.09. wurden dabei auch
   Wiederholungen mit Fußabstoß gezählt; ab 30.09. nur echte. */
export const REALITY: Record<string, { exercise: string; noteBefore?: string; note?: string }> = {
  "0-2": {
    exercise: "muscle-up-band",
    noteBefore: "2026-09-30",
    note: "v1-Zählung inkl. Wiederholungen mit Fußabstoß",
  },
};

/* Warm-up/Cool-down: Am 03.08.2026 (98d7b52) bekam der Cool-down von Tag A und B
   „Cardio locker“ an Index 0. Abhaken gab es erst seit demselben Tag (84822eb),
   und die Daten von diesem Tag nutzen schon die neue Reihenfolge – keine Korrektur
   nötig, Indizes außerhalb der Liste werden aber als Warnung gemeldet. */
