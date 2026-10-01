import type { CollectionConfig, Field } from 'payload'
import { loggedIn } from '../access'
import { slugId } from './fields'

const routine = (name: string, label: string): Field => ({
  name, type: 'array', label,
  fields: [
    { name: 'key', type: 'text', required: true, label: 'Stabile ID' },
    { name: 'name', type: 'text', required: true },
    { name: 'detail', type: 'textarea' },
    { name: 'cardio', type: 'checkbox', label: 'öffnet die Cardio-Erfassung' },
  ],
})

export const Workouts: CollectionConfig = {
  slug: 'workouts',
  labels: { singular: 'Workout', plural: 'Workouts' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'focus', 'id'], group: 'Katalog' },
  access: { read: loggedIn, create: loggedIn, update: loggedIn, delete: loggedIn },
  fields: [
    slugId,
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'focus', type: 'text', label: 'Fokus' }] },
    {
      name: 'slots', type: 'array', label: 'Ablauf',
      admin: { description: 'Reihenfolge = Trainingsreihenfolge' },
      fields: [
        {
          name: 'block', type: 'select', required: true,
          options: [
            { label: 'Skill', value: 'skill' }, { label: 'Kraft', value: 'strength' },
            { label: 'Core', value: 'core' }, { label: 'Zubehör', value: 'accessory' }, { label: 'Extra', value: 'extra' },
          ],
        },
        { name: 'progression', type: 'relationship', relationTo: 'progressions', required: true },
      ],
    },
    routine('warmup', 'Warm-up'),
    routine('cooldown', 'Cool-down'),
  ],
}
