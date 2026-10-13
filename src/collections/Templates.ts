import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'
import { slugId } from './fields'

/** Bibliothek: Plan- und Workout-Vorlagen (Plan-Tab → Vorlagen). Workouts im App-Format als JSON. */
export const Templates: CollectionConfig = {
  slug: 'templates',
  labels: { singular: 'Vorlage', plural: 'Vorlagen' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'kind', 'level', 'days', 'minutes'], group: 'Katalog' },
  access: { read: loggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    slugId,
    { name: 'name', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, label: 'Art', options: [{ label: 'Plan', value: 'plan' }, { label: 'Workout', value: 'workout' }] },
      { name: 'level', type: 'select', required: true, label: 'Niveau', options: [{ label: 'Einsteiger', value: 'beginner' }, { label: 'Fortgeschritten', value: 'intermediate' }, { label: 'Erfahren', value: 'advanced' }] },
      { name: 'days', type: 'number', label: 'Tage/Woche' },
      { name: 'minutes', type: 'number', required: true, label: 'Minuten' },
    ] },
    { name: 'description', type: 'textarea', required: true, label: 'Beschreibung' },
    {
      name: 'equipment', type: 'select', hasMany: true, label: 'Ausrüstung',
      options: ['bar', 'rings', 'parallettes', 'dip-bars', 'band', 'box', 'weight', 'pole'].map(v => ({ label: v, value: v })),
    },
    { name: 'workouts', type: 'json', required: true, label: 'Workouts', admin: { description: 'Im App-Format (wie im Plan): id, name, focus, slots [{ block, progression, sets }], warmup, cooldown' } },
    { name: 'weekplan', type: 'json', label: 'Wochentage', admin: { description: 'Nur bei Plänen: { "mon": "<workout-id>", … }' } },
  ],
}
