/* Meine Workouts: gemeinsame Helfer für Liste, Editor und Tagesbelegung */
import type { Workout, WorkoutId } from '@lever/domain/model.ts'
import type { Training } from '@lever/core/useTraining.ts'
import * as L from '@lever/core/logic.ts'
import { tn } from '@lever/core/i18n/index.ts'

export const exerciseCount = (n: number) => tn('editor.exercises', n)
/** Umfang eines Workouts: „3 Übungen“, mit Runden-Block „3 Übungen · Max. Runden · 20 min“,
    nur Runden „Max. Runden · 20 min“ (statt „0 Übungen“) */
export function workoutSize(w: Workout): string {
  const circuits = L.circuitsOf(w).map(L.fmtCircuitRule)
  return [...(w.slots.length || !circuits.length ? [exerciseCount(w.slots.length)] : []), ...circuits].join(' · ')
}
export const daysOf = (t: Training, id: WorkoutId) => L.plannedDays(t.ix, id).map(d => L.WEEKDAY_SHORT[d]).join(' · ')
