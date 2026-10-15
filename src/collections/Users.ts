import { APIError, type CollectionConfig } from 'payload'
import { adminField, adminPanel, isAdmin, selfOrAdmin, selfOrAdminField } from '../access'
import { clientIp, createLimiter } from '../sync/rateLimit'

/* Bremse je IP gegen Passwort-Raten über viele Konten hinweg (je Konto sperrt Payload selbst nach
   5 Fehlversuchen für 10 Minuten), gegen Mail-Fluten über „Passwort vergessen“ und gegen
   Massen-Registrierungen */
export const MIN_PASSWORD = 8
const AUTH_LIMITS = {
  create: createLimiter(5, 60 * 60_000),
  login: createLimiter(20, 15 * 60_000),
  forgotPassword: createLimiter(5, 60 * 60_000),
  resetPassword: createLimiter(10, 60 * 60_000),
} as const

const base = () => process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const link = (path: string, token: string) => `${base()}${path}?token=${encodeURIComponent(token)}`
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
/** schlichte Mail im Lever-Stil: Überschrift, ein Satz, ein Knopf (plus Link als Text für Mail-Programme ohne HTML-Knöpfe) */
function mail(title: string, text: string, href: string, button: string) {
  return `<!doctype html><html><body style="margin:0;background:#101010;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#ededed">
<div style="max-width:480px;margin:0 auto;padding:40px 24px">
<p style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#D4FF3A;font-weight:700;margin:0 0 12px">Lever</p>
<h1 style="font-size:28px;line-height:1.1;margin:0 0 16px;text-transform:uppercase">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5;color:#c9c9c9;margin:0 0 28px">${esc(text)}</p>
<a href="${esc(href)}" style="display:inline-block;background:#D4FF3A;color:#101010;text-decoration:none;font-weight:800;text-transform:uppercase;padding:14px 26px;border-radius:999px">${esc(button)}</a>
<p style="font-size:12px;line-height:1.5;color:#7d7d7d;margin:28px 0 0;word-break:break-all">${esc(href)}</p>
</div></body></html>`
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'Personen' },
  admin: { useAsTitle: 'email', group: 'System' },
  // Registrierung offen (Rolle bleibt athlete, s. Feld), jede Person sieht und ändert nur sich selbst;
  // löschen und Admin-Panel nur Admins (eigenes Konto löschen: POST /api/account/delete)
  access: { read: selfOrAdmin, update: selfOrAdmin, create: () => true, delete: isAdmin, admin: adminPanel },
  hooks: {
    beforeOperation: [({ operation, req, args }) => {
      const limiter = AUTH_LIMITS[operation as keyof typeof AUTH_LIMITS]
      const ip = clientIp(req.headers)
      // Local API (Skripte, Seed) hat keine Adresse – nur echte HTTP-Anfragen bremsen
      if (limiter && ip && !limiter.take(`${operation}:${ip}`)) throw new APIError('Zu viele Versuche – bitte später erneut', 429)
      // Passwort-Mindestlänge (Payload prüft keine): bei Registrierung, Zurücksetzen und Ändern
      const pw = (args as { data?: { password?: unknown } }).data?.password
      if (typeof pw === 'string' && pw.length < MIN_PASSWORD) throw new APIError(`Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen`, 400)
      return args
    }],
    // Erste Person einer leeren Datenbank (Admin-Panel „Ersten Benutzer anlegen“) wird Admin
    beforeChange: [async ({ req, operation, data }) => {
      if (operation === 'create') {
        const { totalDocs } = await req.payload.count({ collection: 'users', req })
        if (totalDocs === 0) data.role = 'admin'
        // „bestätigt“ setzen nur Admins und Server-Code, der das ausdrücklich sagt (Apple-Anmeldung) –
        // sonst könnte eine angemeldete Person Konten an der Mail-Bestätigung vorbei anlegen
        if (req.user?.role !== 'admin' && !req.context?.verifiedBySystem) delete data._verified
      }
      return data
    }],
  },
  // Lange Sitzung: Im Gym soll niemand alle zwei Stunden neu anmelden müssen.
  // Die App erneuert das Token bei jedem Start, solange sie benutzt wird.
  auth: {
    tokenExpiration: 60 * 60 * 24 * 60,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
    // Anmeldung erst nach Bestätigung der E-Mail; die Links führen auf eigene Seiten (/konto/…),
    // nicht ins Admin-Panel, das nur Admins öffnen dürfen
    verify: {
      generateEmailSubject: () => 'Lever: Bitte bestätige deine E-Mail-Adresse',
      generateEmailHTML: ({ token }) => mail('Willkommen bei Lever',
        'Bitte bestätige deine E-Mail-Adresse, dann kannst du dich in der App anmelden.',
        link('/konto/bestaetigen', token), 'E-Mail bestätigen'),
    },
    forgotPassword: {
      generateEmailSubject: () => 'Lever: Neues Passwort festlegen',
      generateEmailHTML: (args) => mail('Neues Passwort',
        'Über den Link legst du ein neues Passwort fest. Er gilt eine Stunde. Hast du das nicht angefordert, ignoriere diese Mail.',
        link('/konto/passwort', args?.token ?? ''), 'Passwort festlegen'),
    },
  },
  fields: [
    {
      name: 'role', type: 'select', required: true, defaultValue: 'athlete', label: 'Rolle',
      options: [{ label: 'Athlet:in', value: 'athlete' }, { label: 'Admin', value: 'admin' }],
      saveToJWT: true,
      // nur Admins setzen Rollen – sonst macht sich jede:r selbst zum Admin
      access: { create: adminField, update: adminField },
      admin: { position: 'sidebar' },
    },
    {
      // Sign in with Apple: stabile Kennung der Apple-ID – nur der Server setzt sie (POST /api/auth/apple)
      name: 'appleSub', type: 'text', unique: true, index: true, label: 'Apple-ID (Kennung)',
      access: { create: () => false, update: () => false, read: selfOrAdminField },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      // Einwilligung in die Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO): Version des Textes + Zeitpunkt
      name: 'consent', type: 'group', label: 'Einwilligung',
      fields: [
        { name: 'healthVersion', type: 'text', label: 'Gesundheitsdaten – Textversion' },
        { name: 'healthAt', type: 'date', label: 'Gesundheitsdaten – erteilt am' },
      ],
    },
    {
      name: 'state',
      type: 'group',
      label: 'Trainingsstand',
      fields: [
        {
          name: 'current',
          type: 'json',
          label: 'Aktuelle Stufe je Progression',
          admin: { description: 'Progressions-ID → Übungs-ID (nicht Stufen-Index)' },
        },
        { name: 'paused', type: 'relationship', relationTo: 'progressions', hasMany: true, label: 'Pausiert' },
        { name: 'phases', type: 'json', label: 'Phasen', admin: { description: 'Pause, Urlaub, Verletzung, Equipment – geprüft beim Sync (isPhase)' } },
        { name: 'challenges', type: 'json', label: 'Eigene Challenges', admin: { description: 'Selbst angelegte Challenges – geprüft beim Sync (isChallenge)' } },
        { name: 'profile', type: 'json', label: 'Profil', admin: { description: 'Ziele, Ausrüstung, Trainingstage, Dauer – geprüft beim Sync (isProfile)' } },
        { name: 'clientUpdatedAt', type: 'number', admin: { readOnly: true } },
      ],
    },
  ],
}
