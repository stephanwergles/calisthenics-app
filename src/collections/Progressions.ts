import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'
import { slugId } from './fields'

export const Progressions: CollectionConfig = {
  slug: 'progressions',
  labels: { singular: 'Progression', plural: 'Progressionen' },
  admin: { useAsTitle: 'id', defaultColumns: ['id', 'steps'], group: 'Katalog' },
  access: { read: loggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    slugId,
    {
      name: 'region', type: 'select', label: 'Körperregion',
      options: [
        { label: 'Ziehen', value: 'pull' }, { label: 'Drücken', value: 'push' },
        { label: 'Rumpf', value: 'core' }, { label: 'Beine', value: 'legs' },
      ],
    },
    {
      name: 'steps', type: 'array', label: 'Stufen', minRows: 1,
      admin: { description: 'Reihenfolge = Progression. Die Vorgabe gehört zur Stufe, nicht zur Übung.' },
      fields: [
        { name: 'exercise', type: 'relationship', relationTo: 'exercises', required: true, label: 'Übung' },
        {
          name: 'target', type: 'group', label: 'Vorgabe',
          fields: [
            { name: 'label', type: 'text', required: true, label: 'Anzeige (z. B. „4 × 6–8“)' },
            {
              type: 'row',
              fields: [
                { name: 'sets', type: 'number', required: true, label: 'Sätze' },
                { name: 'min', type: 'number', label: 'min' },
                { name: 'max', type: 'number', label: 'max' },
                { name: 'restSec', type: 'number', required: true, label: 'Pause (s)' },
                { name: 'unlockAt', type: 'number', label: 'Freischalten ab' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
