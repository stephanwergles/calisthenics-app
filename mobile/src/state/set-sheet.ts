/* Zustand des nativen Erfassungs-Sheets (app/log-set.tsx): ist es offen, welche Höhen kann es
   annehmen (Erfassung · mit Notiz, in pt vom unteren Rand) und welche ist gewählt –
   damit das Training es öffnen/schließen und seinen Inhalt darüber scrollen lassen kann. */
import { useSyncExternalStore } from 'react'

/** Stufen des Sheets: 0 = Erfassung, 1 = mit Notiz */
export type SheetStop = 0 | 1
type S = { open: boolean; detents: number[]; sel: SheetStop; height: number }
let s: S = { open: false, detents: [], sel: 0, height: 0 }
const subs = new Set<() => void>()
const withHeight = (x: S): S => ({ ...x, height: x.detents[Math.min(x.sel, x.detents.length - 1)] ?? 0 })

export const setSheet = {
  get: () => s,
  set(patch: Partial<S>) { s = withHeight({ ...s, ...patch }); subs.forEach(f => f()) },
  subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f) } },
}
export const useSetSheet = () => useSyncExternalStore(setSheet.subscribe, setSheet.get)
