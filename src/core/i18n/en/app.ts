/* English: app */
import type { Shape } from '..'
import type { app as de } from '../de/app'

export const app: Shape<typeof de> = {
  tab: { train: 'Today', plan: 'Plan', skills: 'Skills', history: 'Log' },
  tabsLabel: 'Sections',
  planPending: 'Plan suggestion waiting',
  sync: { signedOut: 'Not signed in', error: 'Sync error', pending: 'Changes waiting to sync', synced: 'Synced' },
  profileButton: 'Profile – {status}',
  training: 'Workout',
  restNext: 'Set {set} of {total}',
  restNextSub: '{name} · Target {target}',
  replay: '{label} – play again',
}
