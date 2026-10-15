/* POST /api/auth/resend-verification – Bestätigungsmail erneut senden (z. B. wenn die erste nicht ankam).
   Antwortet immer gleich, auch ohne Konto oder bei schon bestätigten – verrät nicht, welche Adressen es gibt. */
import type { PayloadHandler } from 'payload'
import { clientIp, createLimiter } from './rateLimit'

const limiter = createLimiter(5, 60 * 60_000)

export const resendVerificationHandler: PayloadHandler = async req => {
  const ip = clientIp(req.headers)
  if (ip && !limiter.take(`resend:${ip}`)) return Response.json({ error: 'Zu viele Versuche – bitte später erneut' }, { status: 429 })
  const body = await req.json?.().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > 254) return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
  const { payload } = req
  const user = (await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })).docs[0] as
    { id: number | string; email: string; _verified?: boolean; _verificationToken?: string } | undefined
  if (user && !user._verified && user._verificationToken) {
    const verify = payload.collections.users.config.auth.verify
    if (verify && typeof verify === 'object' && verify.generateEmailHTML && verify.generateEmailSubject) {
      const args = { req, token: user._verificationToken, user } as never
      await payload.sendEmail({ to: user.email, subject: await verify.generateEmailSubject(args), html: await verify.generateEmailHTML(args) })
        .catch((e: Error) => payload.logger.error(`Bestätigungsmail an Konto ${user.id} fehlgeschlagen: ${e.message}`))
    }
  }
  return Response.json({ sent: true })
}
