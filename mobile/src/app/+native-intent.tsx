/* Eingehende Links vor der Navigation: Die Live Activity öffnet die App mit lever://training.
   – App lief schon und das Training ist offen: nichts tun (sonst läge ein zweites Training darüber –
     verzerrt, ohne Satz-Sheet, beim Schließen ging das echte mit)
   – Kaltstart: auf Heute; die Gates öffnen das laufende Training ohnehin (würde sonst doppelt gepusht)
   Alle anderen Links (Universal Links /konto/…) unverändert. */
import { trainingOpen } from '@/state/live-link'

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (!/(^|[/:])training(\/|\?|$)/.test(path)) return path
  if (initial) return '/'
  return trainingOpen.current ? null : path
}
