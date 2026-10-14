/* Plattform-Adapter der Expo-App für den gemeinsamen Kern (@lever/core/platform.ts).
   - Daten: expo-sqlite (Tabellen rows/kv, JSON), kleine Einstellungen: expo-sqlite/kv-store (synchron)
   - Token: expo-secure-store (Schlüsselbund), Server: extra.apiUrl aus app.config.ts
   - Netz: expo-network, Vordergrund: AppState, Sprache: expo-localization
   - Signale: Ton (expo-audio), Haptik, Pausen-Ende als lokale Benachrichtigung, Display wach
   Wird in src/app/_layout.tsx als Erstes importiert (registriert sich beim Import). */
import { AppState } from 'react-native'
import Constants from 'expo-constants'
import * as SQLite from 'expo-sqlite'
import Storage from 'expo-sqlite/kv-store'
import * as SecureStore from 'expo-secure-store'
import * as Network from 'expo-network'
import { getLocales } from 'expo-localization'
import * as Haptics from 'expo-haptics'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Notifications from 'expo-notifications'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { setPlatform, type Platform, type PlatformDb, type Store } from '@lever/core/platform.ts'
import { t } from '@lever/core/i18n/index.ts'

/* ── Daten ── */
let dbp: Promise<SQLite.SQLiteDatabase> | null = null
function open() {
  dbp ??= SQLite.openDatabaseAsync('lever.db').then(async db => {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS rows (store TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (store, id));
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL);
    `)
    return db
  })
  return dbp
}
const db: PlatformDb = {
  persistent: async () => true,
  async getAll<T>(store: Store) {
    const rows = await (await open()).getAllAsync<{ json: string }>('SELECT json FROM rows WHERE store = ?', store)
    return rows.map(r => JSON.parse(r.json) as T)
  },
  async put(store, value) {
    await (await open()).runAsync('INSERT OR REPLACE INTO rows (store, id, json) VALUES (?, ?, ?)', store, value.id, JSON.stringify(value))
  },
  async remove(store, id) {
    await (await open()).runAsync('DELETE FROM rows WHERE store = ? AND id = ?', store, id)
  },
  async kvGet<T>(key: string) {
    const row = await (await open()).getFirstAsync<{ json: string }>('SELECT json FROM kv WHERE key = ?', key)
    return row ? (JSON.parse(row.json) as T) : undefined
  },
  async kvSet(key, value) {
    const d = await open()
    if (value === undefined) await d.runAsync('DELETE FROM kv WHERE key = ?', key)
    else await d.runAsync('INSERT OR REPLACE INTO kv (key, json) VALUES (?, ?)', key, JSON.stringify(value))
  },
}

/* ── Netz ── */
let online = true
const onlineListeners = new Set<(on: boolean) => void>()
void Network.getNetworkStateAsync().then(s => { online = s.isInternetReachable ?? s.isConnected ?? true }).catch(() => undefined)
Network.addNetworkStateListener(s => {
  const next = s.isInternetReachable ?? s.isConnected ?? true
  if (next === online) return
  online = next
  onlineListeners.forEach(l => l(next))
})

/* ── Signale ── */
let player: AudioPlayer | null = null
function prime() {
  try {
    // Ton auch bei Stummschalter? Nein: wie iOS-Systemtöne – Stumm bleibt stumm, Haptik und Anzeige reichen
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
    player ??= createAudioPlayer(require('../assets/sounds/alarm.wav'))
  } catch { /* ohne Ton weiter */ }
}
function alarm() {
  try {
    prime()
    if (!player) return
    void player.seekTo(0)
    player.play()
  } catch { /* ohne Ton weiter */ }
}

Notifications.setNotificationHandler({
  // im Vordergrund keine Benachrichtigung – dort klingelt der Timer selbst
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
})
const REST_ID = 'rest-end'
let permission: boolean | null = null
let queue: Promise<void> = Promise.resolve()
/** Pausen-Ende planen (ersetzt eine geplante), null hebt auf. Aufrufe laufen nacheinander. */
function restEnd(end: number | null) {
  queue = queue.then(async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(REST_ID)
      if (end === null || end <= Date.now()) return
      if (permission === null) {
        const cur = await Notifications.getPermissionsAsync()
        permission = cur.granted || (await Notifications.requestPermissionsAsync()).granted
      }
      if (!permission) return
      await Notifications.scheduleNotificationAsync({
        identifier: REST_ID,
        content: { title: t('training.rest.notifyTitle'), body: t('training.rest.notifyBody'), sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(end) },
      })
    } catch { /* ohne Benachrichtigung weiter */ }
  })
  return queue
}

const TOKEN = 'payload-token'

export const mobilePlatform: Platform = {
  name: process.env.EXPO_OS === 'android' ? 'android' : 'ios',
  db,
  prefs: {
    get: key => { try { return Storage.getItemSync(key) } catch { return null } },
    set: (key, value) => { try { if (value === null) Storage.removeItemSync(key); else Storage.setItemSync(key, value) } catch { /* egal */ } },
  },
  online: () => online,
  onOnlineChange(cb) { onlineListeners.add(cb); return () => { onlineListeners.delete(cb) } },
  onForeground(cb) {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') cb() })
    return () => sub.remove()
  },
  systemLanguage: () => getLocales()[0]?.languageTag ?? 'de',
  api: {
    base: () => (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'https://calisthenics.apps.blank-studio.de',
    credentials: 'omit',
    tokenAuth: true,
    getToken: () => SecureStore.getItemAsync(TOKEN),
    setToken: async token => { if (token) await SecureStore.setItemAsync(TOKEN, token); else await SecureStore.deleteItemAsync(TOKEN) },
  },
  signals: {
    prime,
    alarm,
    haptic: kind => {
      if (kind === 'tap') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
      else void Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
    },
    restEnd,
    keepAwake: async on => { try { if (on) await activateKeepAwakeAsync('session'); else await deactivateKeepAwake('session') } catch { /* egal */ } },
  },
}

setPlatform(mobilePlatform)
