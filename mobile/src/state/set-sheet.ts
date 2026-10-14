/* Zustand des nativen Erfassungs-Sheets (app/log-set.tsx): ist es offen, und wie hoch ist es –
   damit das Training es öffnen/schließen und seinen Inhalt darüber scrollen lassen kann. */
import { useSyncExternalStore } from 'react'

type S = { open: boolean; height: number }
let s: S = { open: false, height: 0 }
const subs = new Set<() => void>()

export const setSheet = {
  get: () => s,
  set(patch: Partial<S>) { s = { ...s, ...patch }; subs.forEach(f => f()) },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
export const useSetSheet = () => useSyncExternalStore(setSheet.subscribe, setSheet.get)
