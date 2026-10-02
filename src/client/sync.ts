/* Sync-Client: Anmeldung und Abgleich mit /api/sync. Die App liest und schreibt
   ausschließlich lokal; das hier läuft im Hintergrund. Cookies (payload-token)
   setzt Payload selbst, gleiche Domain – kein Token im JavaScript. */
import type { SyncRequest, SyncResponse } from '../sync/convert.ts'

export class AuthError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (res.status === 401 || res.status === 403) throw new AuthError('Nicht angemeldet')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.errors?.[0]?.message ?? data?.error ?? `Fehler ${res.status}`)
  return data as T
}

export async function me(): Promise<{ email: string } | null> {
  const r = await call<{ user: { email: string } | null }>('/api/users/me')
  return r.user ? { email: r.user.email } : null
}

export async function login(email: string, password: string): Promise<{ email: string }> {
  try {
    const r = await call<{ user: { email: string } }>('/api/users/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    return { email: r.user.email }
  } catch (e) {
    if (e instanceof AuthError) throw new Error('E-Mail oder Passwort stimmt nicht.')
    throw e
  }
}

export const logout = () => call('/api/users/logout', { method: 'POST' }).catch(() => undefined)

/** verlängert die Sitzung – bei jedem App-Start, solange die App benutzt wird */
export const refresh = () => call('/api/users/refresh-token', { method: 'POST' }).catch(() => undefined)

export const postSync = (req: SyncRequest) => call<SyncResponse>('/api/sync', { method: 'POST', body: JSON.stringify(req) })

/** Ersetzt das Server-Dokument das lokale? Saubere lokale Dokumente immer;
    noch nicht hochgeladene nur, wenn die Server-Fassung jünger ist. */
export function takeRemote(local: { updatedAt?: number } | undefined, remote: { updatedAt?: number }, localDirty: boolean): boolean {
  return !local || !localDirty || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)
}

export interface Outbox { sessions: string[]; activities: string[]; deletedActivities: string[]; state: boolean }
export const EMPTY_OUTBOX: Outbox = { sessions: [], activities: [], deletedActivities: [], state: false }
export const pendingCount = (o: Outbox) => o.sessions.length + o.activities.length + o.deletedActivities.length + (o.state ? 1 : 0)
