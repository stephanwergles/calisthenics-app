/* Sync-Client: Anmeldung und Abgleich mit /api/sync. Die App liest und schreibt
   ausschließlich lokal; das hier läuft im Hintergrund.
   Browser: Cookie (payload-token) setzt Payload selbst, gleiche Domain – kein Token im JavaScript.
   Apps: anderer Ursprung, deshalb Token aus dem Login im Header (Plattform-Adapter). */
import type { SyncRequest, SyncResponse } from '../sync/convert.ts'
import { platform } from './platform.ts'

const getToken = () => platform().api.getToken()
const setToken = (t: string | null) => platform().api.setToken(t)

export class AuthError extends Error {
  status: number
  constructor(msg: string, status = 401) { super(msg); this.status = status }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(platform().api.base() + path, {
    credentials: platform().api.credentials,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `JWT ${token}` } : {}), ...(init?.headers ?? {}) },
  })
  if (res.status === 401 || res.status === 403) throw new AuthError('Nicht angemeldet', res.status)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errors?.[0]?.message ?? data?.error ?? `Fehler ${res.status}`)
  return data as T
}

export interface Who { email: string; id?: number | string; healthConsent?: string | null }
type ServerUser = { email: string; id: number | string; consent?: { healthVersion?: string | null } }
const who = (u: ServerUser): Who => ({ email: u.email, id: u.id, healthConsent: u.consent?.healthVersion ?? null })

export async function me(): Promise<Who | null> {
  if (platform().api.tokenAuth && !(await getToken())) return null
  const r = await call<{ user: ServerUser | null }>('/api/users/me')
  return r.user ? who(r.user) : null
}

/** Einwilligung (Textversion + Zeitpunkt) am eigenen Konto speichern */
export const saveConsent = (id: number | string, version: string) =>
  call(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ consent: { healthVersion: version, healthAt: new Date().toISOString() } }) })

export async function login(email: string, password: string): Promise<Who> {
  try {
    const r = await call<{ user: ServerUser; token?: string }>('/api/users/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (r.token) await setToken(r.token)
    return who(r.user)
  } catch (e) {
    // 403 = Konto noch nicht bestätigt (Payload „UnverifiedEmail“), 401 = falsch oder gesperrt
    if (e instanceof AuthError) throw new Error(e.status === 403 ? UNVERIFIED : 'E-Mail oder Passwort stimmt nicht.')
    throw e
  }
}
export const UNVERIFIED = 'Bitte bestätige zuerst deine E-Mail-Adresse – der Link steht in der Mail von Lever.'

/** Konto anlegen – angemeldet wird erst nach Klick auf den Bestätigungslink (Mail) */
export async function register(email: string, password: string): Promise<void> {
  try {
    await call('/api/users', { method: 'POST', body: JSON.stringify({ email, password }) })
  } catch (e) {
    // Payload meldet eine vergebene Adresse als ungültiges Feld „email“
    if (/email/i.test((e as Error).message)) throw new Error('Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an oder setze das Passwort zurück.')
    throw e
  }
}

/** Mail mit Link zum neuen Passwort – antwortet immer gleich, auch ohne Konto (verrät nichts) */
export const forgotPassword = (email: string) =>
  call('/api/users/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }).then(() => undefined)

/** Sign in with Apple: Apple-Token gegen ein Lever-Token tauschen (Konto wird bei Bedarf angelegt) */
export async function appleLogin(identityToken: string): Promise<Who> {
  try {
    const r = await call<{ user: ServerUser; token: string }>('/api/auth/apple', { method: 'POST', body: JSON.stringify({ identityToken }) })
    await setToken(r.token)
    return who(r.user)
  } catch (e) {
    if (e instanceof AuthError) throw new Error('Die Anmeldung mit Apple hat nicht geklappt. Bitte versuche es noch einmal.')
    throw e
  }
}

export const logout = () => call('/api/users/logout', { method: 'POST' }).catch(() => undefined).finally(() => setToken(null))

/** verlängert die Sitzung – bei jedem App-Start, solange die App benutzt wird */
export const refresh = () => call<{ refreshedToken?: string }>('/api/users/refresh-token', { method: 'POST' })
  .then(r => (r.refreshedToken ? setToken(r.refreshedToken) : undefined)).catch(() => undefined)

/** Konto samt Server-Daten löschen – danach ist niemand mehr angemeldet */
export const deleteAccount = () => call('/api/account/delete', { method: 'POST' }).finally(() => setToken(null))

/** Feedback aus der App (nur angemeldet; lesen können es nur Admins) */
export const sendFeedback = (f: { category: 'bug' | 'idea' | 'other'; message: string; appVersion: string; platform: 'ios' | 'android' | 'web'; screen?: string }) =>
  call('/api/feedback?depth=0', { method: 'POST', body: JSON.stringify(f) })

export const postSync = (req: SyncRequest) => call<SyncResponse>('/api/sync', { method: 'POST', body: JSON.stringify(req) })

/** Ersetzt das Server-Dokument das lokale? Saubere lokale Dokumente immer;
    noch nicht hochgeladene nur, wenn die Server-Fassung jünger ist. */
export function takeRemote(local: { updatedAt?: number } | undefined, remote: { updatedAt?: number }, localDirty: boolean): boolean {
  return !local || !localDirty || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)
}

export interface Outbox { sessions: string[]; activities: string[]; deletedActivities: string[]; state: boolean; plan?: boolean }
export const EMPTY_OUTBOX: Outbox = { sessions: [], activities: [], deletedActivities: [], state: false, plan: false }
export const pendingCount = (o: Outbox) => o.sessions.length + o.activities.length + o.deletedActivities.length + (o.state ? 1 : 0) + (o.plan ? 1 : 0)
