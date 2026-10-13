/* Kurze Meldungen („Plan übernommen“, „Feedback gesendet“): in der App als native Glas-Kapsel über
   allem, im Browser über <Toaster/>. Aufruf von überall: toast('…', 'success'). */
import { isNative, nativeToast } from './native'

export type ToastTone = 'info' | 'success' | 'error'
export interface ToastMsg { id: number; text: string; tone: ToastTone }
type Listener = (m: ToastMsg) => void

const listeners = new Set<Listener>()
let seq = 0

export function toast(text: string, tone: ToastTone = 'info') {
  if (isNative()) { nativeToast(text, tone); return }
  const m = { id: ++seq, text, tone }
  listeners.forEach(l => l(m))
}
export function onToast(l: Listener) { listeners.add(l); return () => { listeners.delete(l) } }
