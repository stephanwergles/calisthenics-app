'use client'
/* Plattform-Adapter für Browser und Capacitor-App (siehe src/core/platform.ts).
   Registriert sich beim Import – TrainingApp importiert diese Datei als Erstes. */
import { setPlatform, type Platform } from '../core/platform.ts'
import * as db from './db'
import { alarm, keepAwake, primeAudio } from './signals'
import { apiBase, buzz, getToken, isNative, nativeToast, scheduleRestEnd, setToken, tap } from './native'

const hasWindow = () => typeof window !== 'undefined'

export const webPlatform: Platform = {
  get name() { return isNative() ? 'ios' : 'web' },
  db,
  prefs: {
    get: key => { try { return localStorage.getItem(key) } catch { return null } },
    set: (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* ohne Speicher */ } },
  },
  online: () => !hasWindow() || navigator.onLine,
  onOnlineChange(cb) {
    if (!hasWindow()) return () => undefined
    const on = () => cb(true), off = () => cb(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  },
  onForeground(cb) {
    if (!hasWindow()) return () => undefined
    const fn = () => { if (!document.hidden) cb() }
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  },
  systemLanguage: () => (hasWindow() ? navigator.language : 'de'),
  api: {
    base: apiBase,
    get credentials() { return isNative() ? 'omit' as const : 'same-origin' as const },
    get tokenAuth() { return isNative() },
    getToken: async () => (await getToken()) ?? null,
    setToken,
  },
  signals: {
    prime: primeAudio,
    alarm,
    haptic: kind => { if (kind === 'warning') buzz(); else tap() },
    restEnd: end => scheduleRestEnd(end),
    keepAwake,
  },
  toast: (text, tone) => { if (!isNative()) return false; nativeToast(text, tone); return true },
}

setPlatform(webPlatform)
