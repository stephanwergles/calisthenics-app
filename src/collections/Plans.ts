import type { CollectionConfig } from 'payload'
import { loggedIn, ownDocs, setOwner } from '../access'
import { clientUpdatedAt, owner } from './fields'

/** Persönlicher Plan je Person (fehlt er, gilt der Plan aus dem Katalog). Workouts und Wochenplan
    als JSON in derselben Form wie im Katalog – geprüft wird beim Sync (isPlan in src/sync/convert.ts). */
export const Plans: CollectionConfig = {
  slug: 'plans',
  labels: { singular: 'Plan', plural: 'Pläne' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'user', 'version', 'source'], group: 'Training' },
  access: { read: ownDocs, create: loggedIn, update: ownDocs, delete: ownDocs },
  hooks: { beforeChange: [setOwner] },
  fields: [
    owner,
    { name: 'key', type: 'text', required: true, index: true, admin: { description: 'z. B. „main“' } },
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'version', type: 'number', required: true, defaultValue: 1 },
      { name: 'source', type: 'select', required: true, defaultValue: 'custom',
        options: [{ label: 'aus dem Katalog', value: 'catalog' }, { label: 'erzeugt', value: 'generated' }, { label: 'eigen', value: 'custom' }] },
    ] },
    { name: 'workouts', type: 'json', required: true },
    { name: 'weekplan', type: 'json', required: true },
    { name: 'inputs', type: 'json' },
    clientUpdatedAt,
  ],
}
