import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'Personen' },
  admin: { useAsTitle: 'email', group: 'System' },
  auth: true,
  fields: [
    {
      name: 'state',
      type: 'group',
      label: 'Trainingsstand',
      fields: [
        {
          name: 'current',
          type: 'json',
          label: 'Aktuelle Stufe je Progression',
          admin: { description: 'Progressions-ID → Übungs-ID (nicht Stufen-Index)' },
        },
        { name: 'paused', type: 'relationship', relationTo: 'progressions', hasMany: true, label: 'Pausiert' },
      ],
    },
  ],
}
