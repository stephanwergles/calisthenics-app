/* English: circuit */
import type { Shape } from '..'
import type { circuit as de } from '../de/circuit'

export const circuit: Shape<typeof de> = {
  start: 'Start',
  round: 'Round',
  roundOf: 'Round {n} of {total}',
  roundsDone: { one: '{n} round done', other: '{n} rounds done' },
  roundDone: 'Round done',
  undo: 'Take back last round',
  stop: 'Finish early',
  perRound: 'Per round',
  cancel: 'Cancel',
  cancelTitle: 'Cancel the rounds?',
  cancelMessage: 'The result won’t be saved.',
  cancelOk: 'Cancel',
  result: 'Result',
  extraReps: 'Reps of the unfinished round',
  better: 'Better than last time!',
  last: 'Last time: {value}',
  save: 'Done',
  saved: 'Rounds saved',
  section: 'Rounds',
  tapHint: 'Tap = round done',
}
