/* English: common */
import type { Shape } from '..'
import type { common as de } from '../de/common'

export const common: Shape<typeof de> = {
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',
  back: 'Back',
  next: 'Next',
  done: 'Done',
  apply: 'Apply',
  later: 'Later',
  send: 'Send',
  delete: 'Delete',
  edit: 'Edit',
  privacy: 'Privacy policy',
  /* short confirmations as toast */
  toast: {
    synced: 'Synced',
    syncFailed: 'Sync failed',
    planApplied: 'Plan applied',
    suggestionApplied: 'Suggestion applied',
    undone: 'Undone',
    workoutAdded: 'Workout added',
    exported: 'Export saved',
    imported: 'Import complete',
    feedbackSent: 'Feedback sent – thanks!',
    assessmentApplied: 'Placement applied',
    phaseStarted: 'Phase started',
    phaseEnded: 'Phase ended',
    saved: 'Saved',
  },
}
