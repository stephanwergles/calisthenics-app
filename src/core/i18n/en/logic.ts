/* English: labels and formats from logic.ts */
import type { Shape } from '..'
import type { logic as de } from '../de/logic'

export const logic: Shape<typeof de> = {
  weekday: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' },
  weekdayLong: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' },
  region: { pull: 'Pull', push: 'Push', core: 'Core', legs: 'Legs', other: 'More' },
  regionDetail: { pull: 'Back, biceps, grip', push: 'Chest, shoulders, triceps', core: 'Abs, hip flexors', legs: 'Thighs, glutes, calves', other: '' },
  block: { skill: 'Skill', strength: 'Strength', core: 'Core', accessory: 'Accessory', extra: 'Extra' },
  equipment: { bar: 'Bar', rings: 'Rings', parallettes: 'Parallettes', 'dip-bars': 'Dip bars', band: 'Band', box: 'Box', weight: 'Weights', pole: 'Vertical pole' },
  phase: { pause: 'Break / sick', vacation: 'Vacation', injury: 'Injury', equipment: 'Missing equipment' },
  tendon: { shoulder: 'Shoulder', elbow: 'Elbow', wrist: 'Wrist', knee: 'Knee' },
  level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  activity: { run: 'Run', ride: 'Ride', workout: 'Workout' },
  customWorkout: 'Custom workout',
  fullBody: 'Full body',
  stage: 'Stage {i}/{n}',
  stageTarget: 'Stage {i}/{n} · {target}',
  setsChange: '{before} → {after} sets',
  injuredBy: 'Injury: {joints}',
  noEquipment: 'Missing equipment',
  phaseUntil: ' · until {date}',
  phaseOpen: ' · until further notice',
  rounds: '{n} rounds',
  elevation: '{n} m up',
  unitReps: ' reps',
  standingNone: 'no complete session at this stage yet',
  standingSets: { one: 'still missing: {n} set with {target}', other: 'still missing: {n} sets with {target}' },
  standingOneMore: 'still missing: 1 more session, all sets done',
}
