/* Runden-Block bearbeiten (Push-Seite im Workout-Editor): Modus (AMRAP in Minuten oder
   feste Runden auf Zeit), Übungen mit fester Zahl je Runde. Params: id (Workout), cid (Block oder „new“). */
import { useEffect } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { circuitDraft, useCircuitDraft } from '@/state/circuit-draft'
import { ask, Button, color, Icon, radius, Segmented, SheetScreen, Stepper, Text } from '@/ui'
import { Section } from '@/screens/plan/parts'

export default function CircuitScreen() {
  const { t } = useApp()
  const { id, cid } = useLocalSearchParams<{ id: string; cid: string }>()
  const w = t.ix.workouts.get(id)
  const existing = L.circuitsOf(w).find(c => c.id === cid)
  const c = useCircuitDraft()

  // Entwurf beim Öffnen anlegen (bestehender Block oder neuer mit Vorgaben), beim Verlassen verwerfen
  useEffect(() => {
    circuitDraft.set(existing ?? { id: L.newCircuitId('runden'), name: '', mode: 'amrap', minutes: 10, items: [] })
    return () => circuitDraft.set(null)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!w || !c) return <SheetScreen title={tr('editor.circuitNew')} />
  const set = (patch: Partial<typeof c>) => circuitDraft.update(x => ({ ...x, ...patch }))
  const setReps = (i: number, by: number) => set({ items: c.items.map((x, j) => (j === i ? { ...x, reps: Math.max(1, x.reps + by) } : x)) })
  const remove = (i: number) => set({ items: c.items.filter((_, j) => j !== i) })
  const save = () => {
    if (!c.items.length) return
    t.editPlan(p => L.withWorkout(p, L.withCircuit(w, { ...c, name: tr('editor.circuitDefault') })))
    router.back()
  }
  const del = async () => {
    if (!existing || !await ask({ title: tr('editor.circuitDeleteTitle'), ok: tr('editor.delete'), destructive: true })) return
    router.back()
    t.editPlan(p => L.withWorkout(p, L.withoutCircuit(w, existing.id)))
  }

  return (
    <SheetScreen title={tr('editor.circuitNew')} sub={tr('editor.circuitHint')}
      footer={<Button variant="primary" size="lg" icon="check" title={tr('editor.save')} disabled={!c.items.length} onPress={save} />}>
      <Segmented<'amrap' | 'rounds'> label={tr('editor.circuitMode')} value={c.mode}
        options={[{ id: 'amrap', title: tr('editor.circuitAmrap') }, { id: 'rounds', title: tr('editor.circuitRounds') }]}
        onChange={mode => set(mode === 'amrap' ? { mode, minutes: c.minutes ?? 10, rounds: undefined } : { mode, rounds: c.rounds ?? 5, minutes: undefined })} />
      {c.mode === 'amrap'
        ? <Stepper label={tr('editor.circuitMinutes')} value={String(c.minutes ?? 10)}
            onMinus={() => set({ minutes: Math.max(1, (c.minutes ?? 10) - 1) })} onPlus={() => set({ minutes: Math.min(120, (c.minutes ?? 10) + 1) })} />
        : <Stepper label={tr('editor.circuitRoundsCount')} value={String(c.rounds ?? 5)}
            onMinus={() => set({ rounds: Math.max(1, (c.rounds ?? 5) - 1) })} onPlus={() => set({ rounds: Math.min(100, (c.rounds ?? 5) + 1) })} />}

      <Section title={tr('editor.circuitPerRound')} />
      {!c.items.length && <Text variant="muted">{tr('editor.circuitEmpty')}</Text>}
      {c.items.map((x, i) => {
        const e = t.ix.exercises.get(x.exercise)
        return (
          <View key={`${x.exercise}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={2}>{e?.name ?? x.exercise}</Text>
              <Text variant="small">{e?.unit === 'seconds' ? tr('editor.circuitSeconds') : tr('editor.circuitReps')}</Text>
            </View>
            <Button icon="minus" label={tr('editor.circuitLess', { name: e?.name ?? '' })} onPress={() => setReps(i, e?.unit === 'seconds' ? -5 : -1)} />
            <Text variant="num" style={{ fontSize: 26, minWidth: 40, textAlign: 'center' }}>{x.reps}</Text>
            <Button icon="plus" label={tr('editor.circuitMore', { name: e?.name ?? '' })} onPress={() => setReps(i, e?.unit === 'seconds' ? 5 : 1)} />
            <Button variant="ghost" icon="trash" label={tr('editor.circuitRemove', { name: e?.name ?? '' })} onPress={() => remove(i)} />
          </View>
        )
      })}
      {c.items.length < 12 && <Button icon="plus" title={tr('editor.addExercise')} onPress={() => router.push({ pathname: '/workouts/circuit-add', params: { id } })} />}
      {existing && <View style={{ marginTop: 12 }}><Button variant="danger" icon="trash" title={tr('editor.circuitDelete')} onPress={() => void del()} /></View>}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <Icon name="info" size={14} color={color.muted} />
        <Text variant="small" style={{ flex: 1 }}>{tr('editor.circuitLadderNote')}</Text>
      </View>
    </SheetScreen>
  )
}
