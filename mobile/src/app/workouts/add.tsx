/* Übung hinzufügen: Leitern nach Körperregion, die Stufe folgt dem Stand in der Progression.
   (Web: PlanEditor → LadderPicker) */
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { SheetScreen } from '@/ui'
import { Rows, Section } from '@/screens/plan/parts'

export default function AddExerciseScreen() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const w = t.ix.workouts.get(id)
  const groups = w ? L.ladderChoices(t.ix, t.state, w.slots.map(s => s.progression)).filter(g => g.items.length) : []
  return (
    <SheetScreen title={tr('editor.addExercise')} sub={w ? tr('editor.addTo', { name: w.name }) : tr('editor.ladderSub')}>
      {groups.map(g => (
        <View key={g.id} style={{ gap: 8 }}>
          <Section title={g.label} />
          <Rows rows={g.items.map(x => ({
            key: x.pid, title: x.name, subtitle: x.sub, exercise: x.exercise,
            onPress: () => {
              if (!w) return
              t.editPlan(p => L.withWorkout(p, L.withSlot(t.ix, w, x.pid)))
              // zurück zum Editor und gleich die Sätze der neuen Übung zeigen
              router.back()
              router.push({ pathname: '/workouts/slot', params: { id: w.id, pid: x.pid } })
            },
          }))} />
        </View>
      ))}
    </SheetScreen>
  )
}
