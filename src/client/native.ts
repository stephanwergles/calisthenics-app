'use client'
/* Native Hülle (Capacitor, iOS). Im Browser ist alles hier wirkungslos – die Web-App bleibt
   unverändert. In der App:
   - die Oberfläche liegt im App-Paket (capacitor://localhost), nur der Sync geht an den Server,
     angemeldet per Token statt Cookie (anderer Ursprung)
   - Pausen-Ende als lokale Benachrichtigung, auch bei gesperrtem Display
   - Haptik beim Speichern und am Pausenende, Display bleibt während der Session an */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Preferences } from '@capacitor/preferences'
import { KeepAwake } from '@capacitor-community/keep-awake'

export const isNative = () => typeof window !== 'undefined' && Capacitor.isNativePlatform()

/** Server für den Sync: im Browser derselbe Ursprung, in der App die Live-Instanz */
export const apiBase = () => (isNative() ? (process.env.NEXT_PUBLIC_NATIVE_API ?? 'https://calisthenics.apps.blank-studio.de') : '')

/* ── Token (nur App) ── */
const TOKEN = 'payload-token'
export const getToken = async () => (isNative() ? (await Preferences.get({ key: TOKEN })).value : null)
export const setToken = async (token: string | null) => {
  if (!isNative()) return
  if (token) await Preferences.set({ key: TOKEN, value: token })
  else await Preferences.remove({ key: TOKEN })
}

/* ── Pausen-Benachrichtigung ── */
const REST_ID = 1
let permission: boolean | null = null

/** einmal beim Start einer Session fragen – iOS zeigt den Dialog nur beim ersten Mal */
export async function askNotifications() {
  if (!isNative() || permission !== null) return
  try {
    const p = await LocalNotifications.checkPermissions()
    permission = p.display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch { permission = false }
}

/** Benachrichtigung zum Pausenende planen (ersetzt eine geplante) – null hebt sie auf.
    Aufrufe laufen nacheinander: Bei schnellem ±15 s darf kein spätes „Aufheben“ ein neueres „Planen“ überholen. */
let queue: Promise<void> = Promise.resolve()
export function scheduleRestEnd(at: number | null, body = 'Weiter mit dem nächsten Satz.') {
  if (!isNative()) return Promise.resolve()
  queue = queue.then(async () => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
      if (at === null || at <= Date.now()) return
      if (permission === null) await askNotifications()
      if (!permission) return
      await LocalNotifications.schedule({ notifications: [{ id: REST_ID, title: 'Pause vorbei', body, schedule: { at: new Date(at) } }] })
    } catch { /* ohne Benachrichtigung weiter */ }
  })
  return queue
}

/* ── Haptik und wach halten ── */
export const tap = () => { if (isNative()) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined) }
export const buzz = () => { if (isNative()) void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined) }
export async function nativeKeepAwake(on: boolean) {
  if (!isNative()) return false
  try { await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()) } catch { /* egal */ }
  return true
}
