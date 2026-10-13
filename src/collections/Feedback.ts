import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn, setOwner } from '../access'
import { owner } from './fields'

/** Feedback aus der App (Profil → Feedback). Angemeldete Personen dürfen nur anlegen;
    lesen, bearbeiten (Status) und löschen nur Admins. */
export const Feedback: CollectionConfig = {
  slug: 'feedback',
  labels: { singular: 'Feedback', plural: 'Feedback' },
  admin: { useAsTitle: 'message', defaultColumns: ['createdAt', 'category', 'message', 'status', 'appVersion'], group: 'Betrieb' },
  defaultSort: '-createdAt',
  access: { read: isAdmin, create: loggedIn, update: isAdmin, delete: isAdmin },
  hooks: { beforeChange: [setOwner] },
  fields: [
    owner,
    {
      name: 'category', type: 'select', required: true, defaultValue: 'idea', label: 'Art',
      options: [{ label: 'Fehler', value: 'bug' }, { label: 'Idee', value: 'idea' }, { label: 'Sonstiges', value: 'other' }],
    },
    {
      name: 'message', type: 'textarea', required: true, label: 'Nachricht',
      validate: (v: unknown) => (typeof v === 'string' && v.trim().length >= 3 && v.length <= 4000) || '3–4000 Zeichen',
    },
    { type: 'row', fields: [
      { name: 'appVersion', type: 'text', label: 'App-Version', admin: { readOnly: true } },
      { name: 'platform', type: 'select', label: 'Plattform', options: [{ label: 'iOS-App', value: 'ios' }, { label: 'Web', value: 'web' }], admin: { readOnly: true } },
      { name: 'screen', type: 'text', label: 'Ansicht', admin: { readOnly: true } },
    ] },
    {
      name: 'status', type: 'select', defaultValue: 'new', label: 'Status',
      options: [{ label: 'Neu', value: 'new' }, { label: 'Gelesen', value: 'read' }, { label: 'Erledigt', value: 'done' }],
      access: { create: () => false },
      admin: { position: 'sidebar' },
    },
  ],
}
