import type { CollectionConfig } from 'payload'
import { loggedIn, ownDocs, setOwner } from '../access'
import { clientUpdatedAt, localDate, owner } from './fields'

export const Activities: CollectionConfig = {
  slug: 'activities',
  labels: { singular: 'Aktivität', plural: 'Aktivitäten' },
  admin: { useAsTitle: 'key', defaultColumns: ['date', 'kind', 'name', 'durationMin'], group: 'Training' },
  defaultSort: '-date',
  access: { read: ownDocs, create: loggedIn, update: ownDocs, delete: ownDocs },
  hooks: { beforeChange: [setOwner] },
  fields: [
    owner,
    { name: 'key', type: 'text', required: true, index: true },
    { type: 'row', fields: [
      localDate,
      {
        name: 'kind', type: 'select', required: true, label: 'Art',
        options: [{ label: 'Lauf', value: 'run' }, { label: 'Rad', value: 'ride' }, { label: 'Workout (z. B. Cindy)', value: 'workout' }, { label: 'Challenge', value: 'challenge' }],
      },
      { name: 'name', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'durationMin', type: 'number', label: 'Minuten' },
      { name: 'distanceKm', type: 'number', label: 'km' },
      { name: 'elevationM', type: 'number', label: 'Höhenmeter' },
      { name: 'rounds', type: 'number', label: 'Runden' },
    ] },
    { type: 'row', fields: [
      { name: 'challenge', type: 'text', label: 'Challenge (Vorlage)' },
      { name: 'value', type: 'number', label: 'Ergebnis (Wdh. oder s)' },
      { name: 'durationSec', type: 'number', label: 'Zeit (s)' },
    ] },
    { name: 'parts', type: 'json', label: 'Teilsätze' },
    { name: 'note', type: 'textarea', label: 'Notiz' },
    clientUpdatedAt,
  ],
}
