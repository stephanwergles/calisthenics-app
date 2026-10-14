/* Meine Workouts: gemeinsame Helfer für Liste, Editor und Tagesbelegung */
import type { WorkoutId } from '@lever/domain/model.ts'
import type { Training } from '@lever/core/useTraining.ts'
import * as L from '@lever/core/logic.ts'
import { tn } from '@lever/core/i18n/index.ts'

export const exerciseCount = (n: number) => tn('editor.exercises', n)
export const daysOf = (t: Training, id: WorkoutId) => L.plannedDays(t.ix, id).map(d => L.WEEKDAY_SHORT[d]).join(' · ')
