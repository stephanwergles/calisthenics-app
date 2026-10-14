/* Kurze Meldungen („Plan übernommen“, „Feedback gesendet“). Aufruf von überall:
   toast('…', 'success'). Zeichnet die Plattform selbst (iOS-Kapsel in der Capacitor-App),
   sonst hört die Oberfläche über onToast() zu (Toaster im Web, Glas-Toast in der Expo-App). */
import { platform, type ToastTone } from './platform.ts'

export type { ToastTone }
export interface ToastMsg { id: number; text: string; tone: ToastTone }
type Listener = (m: ToastMsg) => void

const listeners = new Set<Listener>()
let seq = 0

export function toast(text: string, tone: ToastTone = 'info') {
  if (platform().toast?.(text, tone)) return
  const m = { id: ++seq, text, tone }
  listeners.forEach(l => l(m))
}
export function onToast(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }
