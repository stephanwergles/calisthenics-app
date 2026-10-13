import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'
import { slugId } from './fields'

/** Split-Vorlagen: ein Thema je Trainingstag; der Generator füllt die Themen-Tage */
export const Splits: CollectionConfig = {
  slug: 'splits',
  labels: { singular: 'Split-Vorlage', plural: 'Split-Vorlagen' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'id'], group: 'Katalog' },
  access: { read: loggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    slugId,
    { name: 'name', type: 'text', required: true },
    {
      name: 'themes', type: 'array', label: 'Tage (Themen)', minRows: 1,
      fields: [{ type: 'row', fields: [
        { name: 'key', type: 'text', required: true, label: 'Kürzel' },
        { name: 'name', type: 'text', required: true, label: 'Name' },
        {
          name: 'regions', type: 'select', hasMany: true, required: true, label: 'Regionen',
          options: [{ label: 'Ziehen', value: 'pull' }, { label: 'Drücken', value: 'push' }, { label: 'Rumpf', value: 'core' }, { label: 'Beine', value: 'legs' }],
        },
      ] }],
    },
  ],
}
