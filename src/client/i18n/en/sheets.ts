/* English: sheets */
import type { Shape } from '..'
import type { sheets as de } from '../de/sheets'

export const sheets: Shape<typeof de> = {
  close: 'Close',
  decrease: 'Decrease {label}',
  increase: 'Increase {label}',
  target: ' · Target {target}',
  save: 'Save',
  cancel: 'Cancel',
  set: {
    sub: 'Set {set} of {planned} · Target {target}',
    seconds: 'Seconds',
    reps: 'Reps',
    weight: 'Added weight',
    note: 'Note for this set',
    notePlaceholder: 'e.g. elbow twinged, used momentum',
    delete: 'Delete',
    startTimer: 'Start timer · {n} s',
    addNote: 'Add note',
  },
  cardio: {
    title: 'Cardio',
    kind: 'Type',
    minutes: 'Minutes',
    km: 'Kilometres',
    elevation: 'Elevation (m)',
  },
  exercise: {
    setup: 'Starting position',
    execution: 'Execution',
    faults: 'Common mistakes',
    scaling: 'Easier · Harder',
    video: 'Tutorial on YouTube',
    undoSkip: 'Do it anyway',
    skip: 'Skip today',
    resume: 'Resume',
    pause: 'Pause indefinitely',
    next: 'Next: {name}',
    prev: 'Back: {name}',
  },
}
