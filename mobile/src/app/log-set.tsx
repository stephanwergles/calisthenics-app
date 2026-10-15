/* Natives Erfassungs-Sheet über dem Training, nicht wegwischbar – das Training öffnet und schließt es.
   Zwei Höhen zum Ziehen: Erfassung und – hochgezogen – mit Notiz. Die Höhen misst
   der Inhalt (screens/training/set-sheet.tsx); hier werden sie in Anteile umgerechnet. Hintergrund
   bleibt bedienbar (Übung wechseln, Technik, Bild). */
import { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { Stack, useNavigation } from 'expo-router'
import { initialWindowMetrics } from 'react-native-safe-area-context'
import { useApp } from '@/state/app'
import { setSheet, useSetSheet, type SheetStop } from '@/state/set-sheet'
import { SetSheetContent } from '@/screens/training/set-sheet'

// bis der Inhalt gemessen ist
const FIRST = [0.42, 0.62]

export default function LogSetSheet() {
  const { focusSlot } = useApp()
  const nav = useNavigation()
  const { detents } = useSetSheet()
  const win = useWindowDimensions()
  // iOS: Stufen sind Anteile der Fensterhöhe ohne beide Sicherheitsabstände, und das Sheet ist
  // um den unteren Sicherheitsabstand höher als seine Stufe (gemessen auf iOS 26)
  const inset = initialWindowMetrics?.insets ?? { top: 59, bottom: 34 }
  const max = win.height - inset.top - inset.bottom
  const fr = detents.length ? detents.map(h => Math.min(1, Math.max(0.05, Math.round((h - inset.bottom) / max * 1000) / 1000))) : FIRST
  // aufsteigend und verschieden, sonst lehnt das Sheet die Stufen ab
  for (let i = 1; i < fr.length; i++) if (fr[i] <= fr[i - 1]) fr[i] = Math.min(1, fr[i - 1] + 0.001)
  useEffect(() => { setSheet.set({ open: true, sel: 0 }); return () => setSheet.set({ open: false, detents: [], sel: 0 }) }, [])
  useEffect(() => nav.addListener('sheetDetentChange' as never, (e: { data: { index: number } }) => {
    setSheet.set({ sel: (e.data.index > 0 ? 1 : 0) as SheetStop })
  }), [nav])
  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: fr }} />
      {focusSlot ? <SetSheetContent key={focusSlot.pid} slot={focusSlot} /> : null}
    </>
  )
}
