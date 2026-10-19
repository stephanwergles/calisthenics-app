/* Training im Vollbild (Web: FocusView + RestOverlay, Orchestrierung in TrainingApp).
   Minimieren schließt nur den Screen – die Session läuft im Mini-Player weiter. Der Pausen-Screen
   liegt darüber, solange die Pause läuft/klingelt und die Ansicht offen ist. */
import { useEffect } from 'react'
import { View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useApp } from '@/state/app'
import { trainingOpen } from '@/state/live-link'
import { useSetSheet } from '@/state/set-sheet'
import { color } from '@/ui'
import { AllDone, FocusExercise, FocusTop } from '@/screens/training/focus'
import { RestScreen } from '@/screens/training/rest'

export default function TrainingScreen() {
  const { t, slots, focusSlot, rest, restView } = useApp()
  // für +native-intent: Link aus der Live Activity nicht noch einmal öffnen, solange das Training offen ist
  useEffect(() => { trainingOpen.current = true; return () => { trainingOpen.current = false } }, [])
  // verlassen, ohne zu starten: vorgemerktes „Nochmal trainieren“ verfällt (Home zeigt wieder „erledigt“)
  const cancelAgain = t.cancelAgain
  useEffect(() => () => cancelAgain(), [cancelAgain])
  const restShown = restView !== null && (rest.running || rest.ringing)
  const index = focusSlot ? slots.findIndex(s => s.pid === focusSlot.pid) : -1
  // natives Erfassungs-Sheet (app/log-set.tsx): offen, solange eine Übung im Fokus ist und keine
  // Pause angezeigt wird; während anderer Sheets (Technik, Übungsliste) bleibt es, wie es ist
  const path = usePathname()
  const sheet = useSetSheet()
  const want = !!focusSlot && !restShown
  useEffect(() => {
    if (want && !sheet.open && path === '/training') {
      const id = setTimeout(() => router.push('/log-set'), 200)
      return () => clearTimeout(id)
    }
    if (!want && sheet.open && path === '/log-set') router.back()
  }, [want, sheet.open, path])
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ flex: 1 }} accessibilityElementsHidden={restShown} importantForAccessibility={restShown ? 'no-hide-descendants' : 'auto'}>
        <FocusTop />
        {focusSlot
          ? <FocusExercise key={focusSlot.pid} slot={focusSlot} index={index} total={slots.length} />
          : <AllDone />}
      </View>
      {restShown && <RestScreen />}
    </View>
  )
}
