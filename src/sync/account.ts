/* POST /api/account/delete – eigenes Konto mit allen Trainingsdaten löschen (App-Store-Pflicht,
   Apple 5.1.1(v)). Löscht nur die anfragende Person: Einheiten und Aktivitäten mit ihren Rechten,
   das Konto selbst mit overrideAccess, weil `users.delete` sonst Admins vorbehalten ist – die ID
   kommt aus dem Token, nie aus der Anfrage. Auf dem Gerät bleiben die Daten (Offline-App). */
import type { PayloadHandler } from 'payload'

export const deleteAccountHandler: PayloadHandler = async req => {
  if (!req.user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const { payload } = req
  const user = req.user.id
  const mine = { user: { equals: user } }
  await payload.delete({ collection: 'sessions', where: mine, req, overrideAccess: false })
  await payload.delete({ collection: 'activities', where: mine, req, overrideAccess: false })
  await payload.delete({ collection: 'plans', where: mine, req, overrideAccess: false })
  await payload.delete({ collection: 'users', id: user, overrideAccess: true })
  payload.logger.info(`Konto ${user} auf eigenen Wunsch gelöscht`)
  // Browser: Anmelde-Cookie entwerten
  const cookie = `${payload.config.cookiePrefix}-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  return Response.json({ deleted: true }, { headers: { 'Set-Cookie': cookie } })
}
