/* POST /api/auth/apple – Sign in with Apple. Die App schickt das identityToken von Apple; geprüft wird
   es gegen Apples öffentliche Schlüssel (Aussteller, Empfänger = unsere Bundle-IDs, Ablauf). Konto:
   erst über die Apple-Kennung (appleSub), sonst über die bestätigte E-Mail (verknüpfen), sonst neu
   anlegen – ohne Bestätigungsmail, Apple hat die Adresse bestätigt. Antwort wie /api/users/login. */
import crypto from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getFieldsToSign, jwtSign, type PayloadHandler, type PayloadRequest, type Where } from 'payload'
import { addSessionToUser } from 'payload/shared'
import { clientIp, createLimiter } from './rateLimit'

const APPLE = 'https://appleid.apple.com'
const keys = createRemoteJWKSet(new URL(`${APPLE}/auth/keys`))
/** erlaubte Empfänger: die App und die Entwicklungs-App (mit APPLE_BUNDLE_IDS überschreibbar) */
const audiences = () => (process.env.APPLE_BUNDLE_IDS || 'de.offected.lever,de.offected.lever.dev').split(',').map(s => s.trim()).filter(Boolean)
const limiter = createLimiter(20, 15 * 60_000)

type AppleClaims = { sub: string; email: string | null; emailVerified: boolean }
/** Anfrage lesen und Apple-Token prüfen – Fehler als fertige Antwort */
async function verified(req: PayloadRequest): Promise<AppleClaims | Response> {
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
  if (!claims.sub) return Response.json({ error: 'Apple-Anmeldung ungültig' }, { status: 401 })
  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  }
}

export const appleSignInHandler: PayloadHandler = async req => {
  const v = await verified(req)
  if (v instanceof Response) return v
  const { sub, email, emailVerified } = v

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
  const safe = { id: user.id, email: user.email, role: (user as { role?: string }).role, consent: (user as { consent?: unknown }).consent, appleSub: sub }
  return Response.json({ user: safe, token: jwt, exp })
}

/* POST /api/auth/apple/link – Apple-ID mit dem angemeldeten Konto verknüpfen (Profil). Danach führt
   „Mit Apple fortfahren“ in dieses Konto, auch mit verborgener E-Mail-Adresse. */
export const appleLinkHandler: PayloadHandler = async req => {
  if (!req.user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  const v = await verified(req)
  if (v instanceof Response) return v
  const { payload } = req
  const taken = (await payload.find({ collection: 'users', where: { appleSub: { equals: v.sub } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (taken && String(taken.id) !== String(req.user.id)) {
    return Response.json({ error: 'Diese Apple-ID gehört schon zu einem anderen Lever-Konto. Lösche das andere Konto oder melde dich dort an.' }, { status: 409 })
  }
  await payload.update({ collection: 'users', id: req.user.id, data: { appleSub: v.sub } as never, overrideAccess: true, depth: 0 })
  return Response.json({ linked: true })
}

/* POST /api/auth/apple/unlink – Verknüpfung lösen (Anmeldung dann nur noch mit E-Mail und Passwort) */
export const appleUnlinkHandler: PayloadHandler = async req => {
  if (!req.user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 })
  await req.payload.update({ collection: 'users', id: req.user.id, data: { appleSub: null } as never, overrideAccess: true, depth: 0 })
  return Response.json({ linked: false })
}
