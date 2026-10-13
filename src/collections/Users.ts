import type { CollectionConfig } from 'payload'
import { adminField, adminPanel, isAdmin, selfOrAdmin } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'Personen' },
  admin: { useAsTitle: 'email', group: 'System' },
  // Jede Person sieht und ändert nur sich selbst; anlegen/löschen und Admin-Panel nur Admins
  access: { read: selfOrAdmin, update: selfOrAdmin, create: isAdmin, delete: isAdmin, admin: adminPanel },
  hooks: {
    // Erste Person einer leeren Datenbank (Admin-Panel „Ersten Benutzer anlegen“) wird Admin
    beforeChange: [async ({ req, operation, data }) => {
      if (operation === 'create') {
        const { totalDocs } = await req.payload.count({ collection: 'users', req })
        if (totalDocs === 0) data.role = 'admin'
      }
      return data
    }],
  },
  // Lange Sitzung: Im Gym soll niemand alle zwei Stunden neu anmelden müssen.
  // Die App erneuert das Token bei jedem Start, solange sie benutzt wird.
  auth: {
    tokenExpiration: 60 * 60 * 24 * 60,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  fields: [
    {
      name: 'role', type: 'select', required: true, defaultValue: 'athlete', label: 'Rolle',
      options: [{ label: 'Athlet:in', value: 'athlete' }, { label: 'Admin', value: 'admin' }],
      saveToJWT: true,
      // nur Admins setzen Rollen – sonst macht sich jede:r selbst zum Admin
      access: { create: adminField, update: adminField },
      admin: { position: 'sidebar' },
    },
    {
      // Einwilligung in die Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO): Version des Textes + Zeitpunkt
      name: 'consent', type: 'group', label: 'Einwilligung',
      fields: [
        { name: 'healthVersion', type: 'text', label: 'Gesundheitsdaten – Textversion' },
        { name: 'healthAt', type: 'date', label: 'Gesundheitsdaten – erteilt am' },
      ],
    },
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
        { name: 'phases', type: 'json', label: 'Phasen', admin: { description: 'Pause, Urlaub, Verletzung, Equipment – geprüft beim Sync (isPhase)' } },
        { name: 'profile', type: 'json', label: 'Profil', admin: { description: 'Ziele, Ausrüstung, Trainingstage, Dauer – geprüft beim Sync (isProfile)' } },
        { name: 'clientUpdatedAt', type: 'number', admin: { readOnly: true } },
      ],
    },
  ],
}
