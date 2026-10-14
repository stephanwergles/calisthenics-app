/* Plattform-Adapter: alles, was der gemeinsame Kern (src/core) von der Umgebung braucht.
   Web/Capacitor (src/client/platformWeb.ts) und die Expo-App (apps/mobile/src/platform.ts)
   registrieren beim Start ihre Umsetzung über setPlatform(). Der Kern greift nie selbst auf
   window, document, localStorage, IndexedDB oder native Module zu.

   Ohne Registrierung (Server, Node-Tests) gilt eine Umsetzung im Speicher, die nichts kann,
   aber auch nichts wirft. */

export type Store = 'sessions' | 'activities'

export interface PlatformDb {
  /** true, wenn Daten einen Neustart überleben (sonst Hinweis in der App) */
  persistent(): Promise<boolean>
  getAll<T>(store: Store): Promise<T[]>
  put<T extends { id: string }>(store: Store, value: T): Promise<void>
  remove(store: Store, id: string): Promise<void>
  kvGet<T>(key: string): Promise<T | undefined>
  /** undefined löscht den Eintrag */
  kvSet(key: string, value: unknown): Promise<void>
}

export type Haptic = 'tap' | 'success' | 'warning'
export type ToastTone = 'info' | 'success' | 'error'

export interface Platform {
  name: 'web' | 'ios' | 'android'
  db: PlatformDb
  /** kleine Einstellungen, synchron (Sprache, ausgeblendete Vorschläge) – wie localStorage */
  prefs: { get(key: string): string | null; set(key: string, value: string | null): void }
  /** Netz: aktueller Stand und Änderungen */
  online(): boolean
  onOnlineChange(cb: (online: boolean) => void): () => void
  /** App kommt in den Vordergrund (Tab sichtbar, App aktiv) */
  onForeground(cb: () => void): () => void
  /** Sprache des Systems, z. B. „de-DE“ */
  systemLanguage(): string
  api: {
    /** Server-Basis-URL; '' = gleicher Ursprung (Browser) */
    base(): string
    /** Cookie (Browser) oder Token im Header (Apps) */
    credentials: 'same-origin' | 'omit'
    /** true: angemeldet nur mit gespeichertem Token (Apps) */
    tokenAuth: boolean
    getToken(): Promise<string | null>
    setToken(token: string | null): Promise<void>
  }
  signals: {
    /** vor einem Timer-Start (immer eine Nutzergeste) – Audio freischalten */
    prime(): void
    /** Ende eines Timers: Ton/Vibration */
    alarm(): void
    haptic(kind: Haptic): void
    /** Pausen-Ende als lokale Benachrichtigung (auch bei gesperrtem Display); null = abbrechen */
    restEnd(end: number | null): Promise<void>
    /** Display während der Session anlassen */
    keepAwake(on: boolean): Promise<void>
  }
  /** optional: Toast selbst zeichnen (true = erledigt), sonst rendert die App-Oberfläche ihn */
  toast?(text: string, tone: ToastTone): boolean
}

const memory: Record<Store, Map<string, unknown>> = { sessions: new Map(), activities: new Map() }
const kv = new Map<string, unknown>()
const prefs = new Map<string, string>()
const noop = () => () => undefined

/** Umsetzung im Speicher – Server, Tests, oder bis eine Plattform registriert ist */
export const memoryPlatform: Platform = {
  name: 'web',
  db: {
    persistent: async () => false,
    getAll: async <T>(s: Store) => [...memory[s].values()] as T[],
    put: async (s, v) => { memory[s].set(v.id, v) },
    remove: async (s, id) => { memory[s].delete(id) },
    kvGet: async <T>(k: string) => kv.get(k) as T | undefined,
    kvSet: async (k, v) => { if (v === undefined) kv.delete(k); else kv.set(k, v) },
  },
  prefs: { get: k => prefs.get(k) ?? null, set: (k, v) => { if (v === null) prefs.delete(k); else prefs.set(k, v) } },
  online: () => true,
  onOnlineChange: noop,
  onForeground: noop,
  systemLanguage: () => 'de',
  api: { base: () => '', credentials: 'same-origin', tokenAuth: false, getToken: async () => null, setToken: async () => undefined },
  signals: { prime: () => undefined, alarm: () => undefined, haptic: () => undefined, restEnd: async () => undefined, keepAwake: async () => undefined },
}

let current: Platform = memoryPlatform
export const platform = () => current
export function setPlatform(p: Platform) { current = p }
