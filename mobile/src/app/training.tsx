/* Training im Vollbild (Web: FocusView + RestOverlay, Orchestrierung in TrainingApp).
   Minimieren schließt nur den Screen – die Session läuft im Mini-Player weiter. Der Pausen-Screen
   liegt darüber, solange die Pause läuft/klingelt und die Ansicht offen ist. */
import { View } from 'react-native'
import { useApp } from '@/state/app'
import { color } from '@/ui'
import { AllDone, FocusExercise, FocusTop } from '@/screens/training/focus'
import { RestScreen } from '@/screens/training/rest'

export default function TrainingScreen() {
  const { slots, focusSlot, rest, restView } = useApp()
  const restShown = restView !== null && (rest.running || rest.ringing)
  const index = focusSlot ? slots.findIndex(s => s.pid === focusSlot.pid) : -1
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
