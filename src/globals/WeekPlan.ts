import type { Field, GlobalConfig } from 'payload'
import { loggedIn } from '../access'

const DAYS: [string, string][] = [['mon', 'Montag'], ['tue', 'Dienstag'], ['wed', 'Mittwoch'], ['thu', 'Donnerstag'], ['fri', 'Freitag'], ['sat', 'Samstag'], ['sun', 'Sonntag']]

export const WeekPlan: GlobalConfig = {
  slug: 'weekplan',
  label: 'Wochenplan',
  admin: { group: 'Katalog' },
  access: { read: loggedIn, update: loggedIn },
  fields: DAYS.map(([name, label]): Field => ({ name, label, type: 'relationship', relationTo: 'workouts' })),
}
