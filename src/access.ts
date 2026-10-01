import type { Access, CollectionBeforeChangeHook } from 'payload'

/** Katalog: Lesen und Pflegen nur angemeldet (später ggf. Rollen) */
export const loggedIn: Access = ({ req }) => Boolean(req.user)

/** Nutzerdaten: jede:r sieht und ändert nur die eigenen Dokumente */
export const ownDocs: Access = ({ req }) => (req.user ? { user: { equals: req.user.id } } : false)

/** Neue Nutzerdaten gehören automatisch der angemeldeten Person */
export const setOwner: CollectionBeforeChangeHook = ({ req, operation, data }) => {
  if (operation === 'create' && req.user && !data.user) data.user = req.user.id
  return data
}
