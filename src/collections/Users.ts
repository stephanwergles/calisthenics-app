import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'Personen' },
  admin: { useAsTitle: 'email', group: 'System' },
  // Lange Sitzung: Im Gym soll niemand alle zwei Stunden neu anmelden müssen.
  // Die App erneuert das Token bei jedem Start, solange sie benutzt wird.
  auth: {
    tokenExpiration: 60 * 60 * 24 * 60,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
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
        { name: 'clientUpdatedAt', type: 'number', admin: { readOnly: true } },
      ],
    },
  ],
}
