import type { CollectionConfig } from 'payload'
import { loggedIn } from '../access'
import { slugId } from './fields'

export const Exercises: CollectionConfig = {
  slug: 'exercises',
  labels: { singular: 'Übung', plural: 'Übungen' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'id', 'unit', 'weighted'], group: 'Katalog' },
  access: { read: loggedIn, create: loggedIn, update: loggedIn, delete: loggedIn },
  fields: [
    slugId,
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'unit', type: 'select', required: true, defaultValue: 'reps', label: 'Einheit',
          options: [{ label: 'Wiederholungen', value: 'reps' }, { label: 'Sekunden', value: 'seconds' }],
        },
        { name: 'weighted', type: 'checkbox', label: 'Zusatzgewicht erfassbar' },
        { name: 'perSide', type: 'checkbox', label: 'Werte pro Seite' },
      ],
    },
    {
      name: 'technique', type: 'group', label: 'Technik',
      fields: [
        { name: 'setup', type: 'textarea', label: 'Ausgangsposition' },
        { name: 'execution', type: 'textarea', label: 'Ausführung' },
        { name: 'faults', type: 'textarea', label: 'Häufige Fehler' },
        { name: 'scaling', type: 'textarea', label: 'Leichter · Schwerer' },
      ],
    },
    {
      name: 'media', type: 'group', label: 'Medien',
      fields: [
        { name: 'sketch', type: 'text', label: 'Skizze (v1-SVG-Schlüssel)' },
        { name: 'videoQuery', type: 'text', label: 'YouTube-Suche' },
      ],
    },
  ],
}
