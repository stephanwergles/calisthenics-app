/* Lokale Speicherung in IndexedDB – die App funktioniert vollständig ohne Netz.
   Drei Stores: sessions (keyPath id = datum-workout), activities (keyPath id)
   und kv für Einzelwerte (Trainingsstand, laufende Session, Tageswahl).
   Ohne IndexedDB (z. B. manche privaten Fenster) fällt alles auf den Speicher
   zurück; die App läuft dann, vergisst aber beim Schließen. */

const NAME = 'calisthenics', VERSION = 1
type Store = 'sessions' | 'activities' | 'kv'

let dbp: Promise<IDBDatabase | null> | null = null
const memory: Record<Store, Map<string, unknown>> = { sessions: new Map(), activities: new Map(), kv: new Map() }

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp
  dbp = new Promise(resolve => {
    try {
      const req = indexedDB.open(NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('activities')) db.createObjectStore('activities', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
  return dbp
}

function run<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    if (!db) return reject(new Error('kein IndexedDB'))
    const req = fn(db.transaction(store, mode).objectStore(store))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }))
}

export const persistent = () => open().then(Boolean)

export async function getAll<T>(store: 'sessions' | 'activities'): Promise<T[]> {
  try { return await run<T[]>(store, 'readonly', s => s.getAll()) }
  catch { return [...memory[store].values()] as T[] }
}
export async function put<T extends { id: string }>(store: 'sessions' | 'activities', value: T): Promise<void> {
  memory[store].set(value.id, value)
  try { await run(store, 'readwrite', s => s.put(value)) } catch { /* Speicher-Fallback */ }
}
export async function remove(store: 'sessions' | 'activities', id: string): Promise<void> {
  memory[store].delete(id)
  try { await run(store, 'readwrite', s => s.delete(id)) } catch { /* Speicher-Fallback */ }
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  try { return await run<T | undefined>('kv', 'readonly', s => s.get(key)) }
  catch { return memory.kv.get(key) as T | undefined }
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.kv.set(key, value)
  try { await run('kv', 'readwrite', s => (value === undefined ? s.delete(key) : s.put(value, key))) } catch { /* Fallback */ }
}
