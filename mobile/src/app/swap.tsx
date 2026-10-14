/* Workout für heute tauschen (Sheet statt Aufklappliste in der Heute-Karte – wächst nicht mit und
   bleibt auch bei vielen gespeicherten Workouts übersichtlich) */
import { View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import { useApp } from '@/state/app'
import { Button, color, Icon, ListGroup } from '@/ui'
import { FormSheet } from '@/screens/training/parts'

export default function SwapScreen() {
  const { t } = useApp()
  const current = t.ix.workouts.get(t.workout)
  const pick = (id: string) => { platform().signals.haptic('tap'); t.chooseWorkout(id); router.back() }
  return (
    <FormSheet title={tr('home.swapTitle')} sub={current ? tr('home.swapSub', { name: current.name }) : undefined}
      footer={<Button variant="ghost" icon="right" title={tr('home.manage')} onPress={() => { router.back(); router.navigate('/plan') }} />}>
      <ListGroup rows={L.workoutsInWeekOrder(t.ix).map(w => {
        const days = L.plannedDays(t.ix, w.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || tr('home.noDays')
        const on = w.id === t.workout
        return {
          title: w.name,
          subtitle: [w.focus, days, w.id === t.recommended ? tr('home.recommended') : ''].filter(Boolean).join(' · '),
          onPress: () => pick(w.id),
          accessory: on ? <Icon name="check" size={18} color={color.accent} weight="bold" /> : <View style={{ width: 18 }} />,
        }
      })} />
    </FormSheet>
  )
}
