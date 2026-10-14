/* Übung im Workout: Sätze, Reihenfolge, entfernen – Sheet mit Detents über dem Editor.
   FormSheet statt SheetScreen: SheetScreen bekommt im formSheet keine Höhe (leeres Sheet). */
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, ChipChoices, font, Stepper, Text } from '@/ui'
import { FormSheet } from '@/screens/training/parts'

export default function SlotScreen() {
  const { t } = useApp()
  const { id, pid } = useLocalSearchParams<{ id: string; pid: string }>()
  const w = t.ix.workouts.get(id)
  const i = w ? w.slots.findIndex(s => s.progression === pid) : -1
  if (!w || i < 0 || !t.ix.progressions.has(pid)) return <FormSheet title={tr('editor.addExercise')} />
  const step = L.slotStep(t.ix, t.state, w.slots[i])
  const own = L.currentStep(t.ix, t.state, pid)
  const sets = w.slots[i].sets ?? step.target.sets
  const steps = t.ix.progressions.get(pid)!.steps
  const setStage = (exercise: string | undefined) => change(L.withSlotExercise(t.ix, w, pid, exercise === own.exercise.id ? undefined : exercise))
  const change = (next: typeof w) => t.editPlan(p => L.withWorkout(p, next))
  const setSets = (n: number) => { if (n >= 1 && n <= 10) change(L.withSlotSets(t.ix, w, pid, n)) }
  const move = (by: -1 | 1) => change(L.movedSlot(t.ix, w, pid, by))
  const remove = () => { router.back(); change(L.withoutSlot(t.ix, w, pid)) }

  return (
    <FormSheet title={step.exercise.name}
      sub={tr('editor.slotSub', { stage: step.index + 1, total: step.total, target: step.target.label })}>
      {/* Stufe: mitwachsend (deine aktuelle) oder fest (z. B. normale Liegestütze im Zirkel-Tag) */}
      <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('editor.stageHead')}</Text>
      <ChipChoices items={[
        { id: '__auto', title: tr('editor.stageAuto', { name: own.exercise.name }), on: !step.fixed },
        ...steps.filter(x => x.exercise !== own.exercise.id).map(x => ({ id: x.exercise, title: t.ix.exercises.get(x.exercise)?.name ?? x.exercise, on: !!step.fixed && step.exercise.id === x.exercise })),
      ]} onToggle={id => setStage(id === '__auto' ? undefined : id)} />
      <Text variant="small">{step.fixed ? tr('editor.stageFixedHint') : tr('editor.stageAutoHint')}</Text>
      <Stepper label={tr('editor.sets')} value={String(sets)} minusLabel={tr('editor.setsLess')} plusLabel={tr('editor.setsMore')}
        onMinus={() => setSets(sets - 1)} onPlus={() => setSets(sets + 1)} />
      <Text variant="small">{tr('editor.slotSetsHint')}</Text>
      <ButtonRow>
        <Button style={{ flex: 1 }} icon="up" title={tr('editor.earlier')} disabled={i <= 0} onPress={() => move(-1)} />
        <Button style={{ flex: 1 }} icon="lower" title={tr('editor.later')} disabled={i >= w.slots.length - 1} onPress={() => move(1)} />
      </ButtonRow>
      <Button variant="danger" icon="minus" title={tr('editor.remove')} onPress={remove} />
    </FormSheet>
  )
}
