/* POST /api/auth/apple – Sign in with Apple. Die App schickt das identityToken von Apple; geprüft wird
   es gegen Apples öffentliche Schlüssel (Aussteller, Empfänger = unsere Bundle-IDs, Ablauf). Konto:
   erst über die Apple-Kennung (appleSub), sonst über die bestätigte E-Mail (verknüpfen), sonst neu
   anlegen – ohne Bestätigungsmail, Apple hat die Adresse bestätigt. Antwort wie /api/users/login. */
import crypto from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getFieldsToSign, jwtSign, type PayloadHandler, type Where } from 'payload'
import { addSessionToUser } from 'payload/shared'
import { clientIp, createLimiter } from './rateLimit'

const APPLE = 'https://appleid.apple.com'
const keys = createRemoteJWKSet(new URL(`${APPLE}/auth/keys`))
/** erlaubte Empfänger: die App und die Entwicklungs-App (mit APPLE_BUNDLE_IDS überschreibbar) */
const audiences = () => (process.env.APPLE_BUNDLE_IDS || 'de.offected.lever,de.offected.lever.dev').split(',').map(s => s.trim()).filter(Boolean)
const limiter = createLimiter(20, 15 * 60_000)

export const appleSignInHandler: PayloadHandler = async req => {
  const ip = clientIp(req.headers)
  if (ip && !limiter.take(`apple:${ip}`)) return Response.json({ error: 'Zu viele Versuche – bitte später erneut' }, { status: 429 })
  const body = await req.json?.().catch(() => null) as { identityToken?: unknown } | null
  const token = typeof body?.identityToken === 'string' ? body.identityToken : ''
  if (!token || token.length > 4096) return Response.json({ error: 'Kein Apple-Token' }, { status: 400 })

  let claims: { sub?: string; email?: string; email_verified?: boolean | string }
  try {
    ({ payload: claims } = await jwtVerify(token, keys, { issuer: APPLE, audience: audiences() }))
  } catch {
    return Response.json({ error: 'Apple-Anmeldung ungültig' }, { status: 401 })
  }
  const sub = claims.sub
  if (!sub) return Response.json({ error: 'Apple-Anmeldung ungültig' }, { status: 401 })
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true'

  const { payload } = req
  const one = async (where: Where) =>
    (await payload.find({ collection: 'users', where, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0]
  let user = await one({ appleSub: { equals: sub } })
  if (!user && email && emailVerified) {
    const existing = await one({ email: { equals: email } })
    if (existing) user = await payload.update({ collection: 'users', id: existing.id, data: { appleSub: sub, _verified: true } as never, overrideAccess: true, depth: 0 })
  }
  if (!user) {
    // ohne E-Mail (sollte Apple beim ersten Mal immer liefern) kein Konto – sonst gäbe es eins ohne Adresse
    if (!email) return Response.json({ error: 'Apple hat keine E-Mail-Adresse übermittelt' }, { status: 400 })
    user = await payload.create({
      collection: 'users', overrideAccess: true, disableVerificationEmail: true, depth: 0, context: { verifiedBySystem: true },
      data: { email, password: crypto.randomBytes(32).toString('hex'), appleSub: sub, _verified: true } as never,
    })
    payload.logger.info(`Konto ${user.id} über Sign in with Apple angelegt`)
  }

  // Token wie bei /api/users/login: Sitzung am Konto (widerrufbar), signiert mit dem Payload-Secret
  const collectionConfig = payload.collections.users.config
  const typed = { ...user, collection: 'users' } as never
  const { sid } = await addSessionToUser({ collectionConfig, payload, req, user: typed })
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, user: typed, ...(sid ? { sid } : {}) })
  const { exp, token: jwt } = await jwtSign({ fieldsToSign, secret: payload.secret, tokenExpiration: collectionConfig.auth.tokenExpiration })
  const safe = { id: user.id, email: user.email, role: (user as { role?: string }).role, consent: (user as { consent?: unknown }).consent }
  return Response.json({ user: safe, token: jwt, exp })
}
