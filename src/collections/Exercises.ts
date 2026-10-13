import type { CollectionConfig } from 'payload'
import { isAdmin, loggedIn } from '../access'
import { slugId } from './fields'

const EQUIPMENT = [
  { label: 'Stange', value: 'bar' }, { label: 'Ringe', value: 'rings' }, { label: 'Parallettes', value: 'parallettes' },
  { label: 'Barren', value: 'dip-bars' }, { label: 'Band', value: 'band' }, { label: 'Box', value: 'box' },
  { label: 'Zusatzgewicht', value: 'weight' }, { label: 'Senkrechte Stange / Sprossenwand', value: 'pole' },
  { label: 'Boden', value: 'floor' }, { label: 'Wand', value: 'wall' },
]
const PATTERNS = [
  { label: 'Zug vertikal', value: 'vertical-pull' }, { label: 'Zug horizontal', value: 'horizontal-pull' },
  { label: 'Druck vertikal', value: 'vertical-push' }, { label: 'Druck horizontal', value: 'horizontal-push' },
  { label: 'Kniebeuge', value: 'squat' }, { label: 'Hüftstreckung', value: 'hinge' }, { label: 'Rumpf', value: 'core' }, { label: 'Isolation', value: 'isolation' },
]
const TENDONS: [string, string][] = [['wrist', 'Handgelenk'], ['elbow', 'Ellenbogen'], ['shoulder', 'Schulter'], ['knee', 'Knie']]

export const Exercises: CollectionConfig = {
  slug: 'exercises',
  labels: { singular: 'Übung', plural: 'Übungen' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'id', 'unit', 'weighted'], group: 'Katalog' },
  access: { read: loggedIn, create: isAdmin, update: isAdmin, delete: isAdmin },
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
    { name: 'cues', type: 'text', hasMany: true, maxRows: 3, label: 'Kernpunkte (max. 3)' },
    { name: 'muscles', type: 'text', hasMany: true, label: 'Muskeln / Schwerpunkte' },
    {
      name: 'meta', type: 'group', label: 'Metadaten (Generator, Phasen)',
      admin: { description: 'Grundlage für Planvorschläge und Verletzungs-/Equipment-Phasen' },
      fields: [
        {
          name: 'alternatives', type: 'array', label: 'Geräte-Alternativen',
          admin: { description: 'Jede Zeile = eine Möglichkeit mit allen nötigen Geräten. Boden und Wand gelten immer als vorhanden.' },
          fields: [{ name: 'items', type: 'select', hasMany: true, label: 'Geräte', options: EQUIPMENT }],
        },
        { type: 'row', fields: [
          { name: 'pattern', type: 'select', label: 'Bewegungsmuster', options: PATTERNS },
          { name: 'difficulty', type: 'number', label: 'Schwierigkeit (1–5)', min: 1, max: 5 },
        ] },
        {
          name: 'stress', type: 'group', label: 'Sehnenbelastung (0–3)',
          fields: [{ type: 'row', fields: TENDONS.map(([name, label]) => ({ name, label, type: 'number' as const, min: 0, max: 3 })) }],
        },
        { name: 'unsure', type: 'text', label: 'Fachlich zu prüfen', admin: { description: 'Offene Frage für die Coach-Prüfung' } },
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
