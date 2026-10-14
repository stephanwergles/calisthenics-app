/* Natives Erfassungs-Sheet über dem Training: Höhe nach Inhalt, Hintergrund bleibt bedienbar
   (Übung wechseln, Technik, Bild), nicht wegwischbar – das Training öffnet und schließt es. */
import { useEffect } from 'react'
import { useApp } from '@/state/app'
import { setSheet } from '@/state/set-sheet'
import { SetSheetContent } from '@/screens/training/set-sheet'

export default function LogSetSheet() {
  const { focusSlot } = useApp()
  useEffect(() => { setSheet.set({ open: true }); return () => setSheet.set({ open: false, height: 0 }) }, [])
  return focusSlot ? <SetSheetContent key={focusSlot.pid} slot={focusSlot} /> : null
}
