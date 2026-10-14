/* Übung im Workout: Sätze, Reihenfolge, entfernen – Sheet mit Detents über dem Editor.
   (Web: PlanEditor → SlotSheet) */
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, SheetScreen, Stepper } from '@/ui'

export default function SlotScreen() {
  const { t } = useApp()
  const { id, pid } = useLocalSearchParams<{ id: string; pid: string }>()
  const w = t.ix.workouts.get(id)
  const i = w ? w.slots.findIndex(s => s.progression === pid) : -1
  if (!w || i < 0 || !t.ix.progressions.has(pid)) return <SheetScreen headerSpace={false} />
  const step = L.currentStep(t.ix, t.state, pid)
  const sets = w.slots[i].sets ?? step.target.sets
  const change = (next: typeof w) => t.editPlan(p => L.withWorkout(p, next))
  const setSets = (n: number) => { if (n >= 1 && n <= 10) change(L.withSlotSets(t.ix, w, pid, n)) }
  const move = (by: -1 | 1) => change(L.movedSlot(t.ix, w, pid, by))
  const remove = () => { router.back(); change(L.withoutSlot(t.ix, w, pid)) }

  return (
    <SheetScreen headerSpace={false} title={step.exercise.name}
      sub={tr('editor.slotSub', { stage: step.index + 1, total: step.total, target: step.target.label })}>
      <Stepper label={tr('editor.sets')} value={String(sets)} minusLabel={tr('editor.setsLess')} plusLabel={tr('editor.setsMore')}
        onMinus={() => setSets(sets - 1)} onPlus={() => setSets(sets + 1)} />
      <ButtonRow>
        <Button style={{ flex: 1 }} icon="up" title={tr('editor.earlier')} disabled={i <= 0} onPress={() => move(-1)} />
        <Button style={{ flex: 1 }} icon="lower" title={tr('editor.later')} disabled={i >= w.slots.length - 1} onPress={() => move(1)} />
      </ButtonRow>
      <Button variant="danger" icon="minus" title={tr('editor.remove')} onPress={remove} />
    </SheetScreen>
  )
}
