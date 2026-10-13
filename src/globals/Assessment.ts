import type { GlobalConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'

/** Kurztest: die Tests (die Schwellen je Leiter stehen an der Progression) */
export const Assessment: GlobalConfig = {
  slug: 'assessment',
  label: 'Einstufung',
  admin: { group: 'Katalog' },
  access: { read: loggedIn, update: isAdmin },
  fields: [{
    name: 'tests', type: 'array', label: 'Tests',
    fields: [
      { type: 'row', fields: [
        { name: 'key', type: 'text', required: true, label: 'Test-ID' },
        { name: 'name', type: 'text', required: true, label: 'Name' },
        { name: 'unit', type: 'select', required: true, label: 'Einheit', options: [{ label: 'Wiederholungen', value: 'reps' }, { label: 'Sekunden', value: 'seconds' }, { label: 'Stufen', value: 'level' }] },
      ] },
      { name: 'levels', type: 'text', hasMany: true, label: 'Stufen (bei Einheit „Stufen“)' },
    ],
  }],
}
