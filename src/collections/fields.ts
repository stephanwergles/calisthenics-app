import type { Field } from 'payload'

/** Stabile Text-ID als Primärschlüssel. Einmal vergeben, nie ändern – die
    gesamte Trainingshistorie verweist darauf. */
export const slugId: Field = {
  name: 'id',
  type: 'text',
  required: true,
  admin: { description: 'Stabile ID (Slug, z. B. „chest-to-bar-pull-up“). Einmal vergeben, nie ändern.' },
}

/** Besitzer-Feld für Nutzerdaten */
export const owner: Field = {
  name: 'user',
  type: 'relationship',
  relationTo: 'users',
  required: true,
  index: true,
  admin: { position: 'sidebar', readOnly: true },
}

/** Lokales Datum YYYY-MM-DD als Text – bewusst kein Datumstyp, damit keine
    Zeitzone das Trainingsdatum verschiebt (v1-Bug vom Juli) */
export const localDate: Field = {
  name: 'date',
  type: 'text',
  label: 'Datum',
  required: true,
  index: true,
  validate: (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) || 'Format YYYY-MM-DD',
}
