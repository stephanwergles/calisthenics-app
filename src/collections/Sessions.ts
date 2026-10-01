import type { CollectionConfig } from 'payload'
import { loggedIn, ownDocs, setOwner } from '../access'
import { localDate, owner } from './fields'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  labels: { singular: 'Einheit', plural: 'Einheiten' },
  admin: { useAsTitle: 'key', defaultColumns: ['date', 'workout', 'durationSec'], group: 'Training' },
  defaultSort: '-date',
  access: { read: ownDocs, create: loggedIn, update: ownDocs, delete: ownDocs },
  hooks: { beforeChange: [setOwner] },
  fields: [
    owner,
    {
      name: 'key', type: 'text', required: true, index: true,
      admin: { description: '„datum-workout“ – macht Import und Sync wiederholbar' },
    },
    { type: 'row', fields: [
      localDate,
      { name: 'workout', type: 'relationship', relationTo: 'workouts', required: true },
      { name: 'durationSec', type: 'number', label: 'Dauer (s)' },
    ] },
    {
      name: 'sets', type: 'array', label: 'Sätze',
      fields: [
        { type: 'row', fields: [
          { name: 'exercise', type: 'relationship', relationTo: 'exercises', required: true, label: 'Übung' },
          { name: 'progression', type: 'relationship', relationTo: 'progressions', label: 'über Progression' },
        ] },
        { type: 'row', fields: [
          { name: 'set', type: 'number', required: true, label: 'Satz' },
          { name: 'value', type: 'number', required: true, label: 'Wert' },
          { name: 'weightKg', type: 'number', label: '+kg' },
          { name: 'attempts', type: 'number', label: 'Versuche' },
        ] },
        { name: 'note', type: 'text', label: 'Notiz' },
      ],
    },
    { name: 'skipped', type: 'relationship', relationTo: 'exercises', hasMany: true, label: 'Übersprungen' },
    { name: 'routineDone', type: 'text', hasMany: true, label: 'Warm-up/Cool-down erledigt' },
  ],
}
