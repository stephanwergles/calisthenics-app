import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'
import { slugId } from './fields'

/** Skills (Ziele): Ziel-Leitern, mitlaufende Support-Leitern, Voraussetzungen → Skill-Vorschläge und Generator */
export const Skills: CollectionConfig = {
  slug: 'skills',
  labels: { singular: 'Skill', plural: 'Skills' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'id'], group: 'Katalog' },
  access: { read: loggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
  fields: [
    slugId,
    { name: 'name', type: 'text', required: true },
    { name: 'targets', type: 'relationship', relationTo: 'progressions', hasMany: true, required: true, label: 'Ziel-Leitern' },
    { name: 'support', type: 'relationship', relationTo: 'progressions', hasMany: true, label: 'Support-Leitern (laufen immer mit)' },
    {
      name: 'prerequisites', type: 'array', label: 'Voraussetzungen',
      fields: [{ type: 'row', fields: [
        { name: 'progression', type: 'relationship', relationTo: 'progressions', required: true, label: 'Leiter' },
        { name: 'minStep', type: 'number', required: true, min: 0, label: 'Mindeststufe (0 = erste)' },
      ] }],
    },
  ],
}
