import type { Access, CollectionBeforeChangeHook, FieldAccess, PayloadRequest } from 'payload'

/* Rechte. Zwei Rollen an `users.role`: `admin` pflegt den Katalog und darf ins Admin-Panel,
   `athlete` (Standard) liest den Katalog und hat nur eigene Daten. */

type WithRole = { id: number | string; role?: string | null } | null | undefined
const userOf = (req: Pick<PayloadRequest, 'user'>) => req.user as WithRole

/** true, wenn die anfragende Person Admin ist */
export const isAdminUser = (req: Pick<PayloadRequest, 'user'>) => userOf(req)?.role === 'admin'

/** Katalog lesen: alle Angemeldeten (der Client lädt ihn per Sync) */
export const loggedIn: Access = ({ req }) => Boolean(req.user)

/** Katalog ändern/löschen, Admin-Panel: nur Admins */
export const isAdmin: Access = ({ req }) => isAdminUser(req)
export const adminPanel = ({ req }: { req: PayloadRequest }) => isAdminUser(req)

/** Feld nur für Admins änderbar (z. B. die Rolle – sonst macht sich jede:r selbst zum Admin) */
export const adminField: FieldAccess = ({ req }) => isAdminUser(req)
/** Feld am Personen-Dokument: lesen nur die Person selbst und Admins */
export const selfOrAdminField: FieldAccess = ({ req, id, doc }) => isAdminUser(req) || (!!userOf(req) && String(userOf(req)!.id) === String(id ?? doc?.id))

/** Person-Dokument: die eigene Person, Admins alle */
export const selfOrAdmin: Access = ({ req }) => {
  const u = userOf(req)
  if (!u) return false
  return u.role === 'admin' ? true : { id: { equals: u.id } }
}

/** Nutzerdaten: jede:r sieht und ändert nur die eigenen Dokumente */
export const ownDocs: Access = ({ req }) => (req.user ? { user: { equals: req.user.id } } : false)

/** Neue Nutzerdaten gehören automatisch der angemeldeten Person – nie einer fremden */
export const setOwner: CollectionBeforeChangeHook = ({ req, operation, data }) => {
  if (operation === 'create' && req.user) data.user = req.user.id
  return data
}
