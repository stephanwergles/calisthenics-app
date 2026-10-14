/* Workout bearbeiten: Übungen (Tipp → Sätze/Reihenfolge), Übung hinzufügen, Wochentage,
   Umbenennen, Löschen. id = „new“: erst den Namen, dann weiter in den Editor des neuen Workouts.
   (Web: PlanEditor → WorkoutEditor, NameSheet) */
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { Weekday, Workout } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { useApp } from '@/state/app'
import { ask, Button, ButtonRow, DayPicker, SheetScreen, Text } from '@/ui'
import { DAY_NAME, ModalToolbar, NameForm, Rows, Section, useIsFirst } from '@/screens/plan/parts'
import { exerciseCount } from '@/screens/plan/workouts'

export default function WorkoutScreen() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const first = useIsFirst()
  if (id === 'new') {
    return (
      <>
        <ModalToolbar close={first} />
        <SheetScreen title={tr('editor.newWorkout')} sub={tr('editor.newSub')}>
          <NameForm ok={tr('editor.create')} onSave={name => {
            const w = L.newWorkout(t.ix, name, [])
            t.editPlan(p => L.withWorkout(p, w))
            router.replace({ pathname: '/workouts/[id]', params: { id: w.id } })
          }} />
        </SheetScreen>
      </>
    )
  }
  const w = t.ix.workouts.get(id)
  if (!w || w.archived) return <><ModalToolbar close={first} /><SheetScreen title={tr('editor.myWorkouts')} /></>
  return <Editor w={w} first={first} />
}

function Editor({ w, first }: { w: Workout; first: boolean }) {
  const { t, startWorkout } = useApp()
  // Training direkt aus der Übersicht starten: Modal schließen, dann starten (läuft schon eins: Hinweis)
  const busy = !!t.active && t.active.workout !== w.id
  const start = () => {
    if (busy) { toast(tr('home.workoutBusy')); return }
    router.dismissAll()
    startWorkout(w.id)
  }
  const weekplan = t.ix.catalog.weekplan
  const other = (d: Weekday) => (weekplan[d] && weekplan[d] !== w.id ? t.ix.workouts.get(weekplan[d]!)?.name : undefined)
  // belegten Tag nicht stillschweigend überschreiben
  const setDay = async (d: Weekday, on: boolean) => {
    const old = on ? other(d) : undefined
    if (old && !await ask({ title: tr('editor.replaceDayTitle', { day: DAY_NAME[d] }), message: tr('editor.replaceDayMsg', { old, name: w.name }), ok: tr('editor.replaceDayOk') })) return
    t.editPlan(p => L.withDay(p, d, on ? w.id : undefined))
  }
  const slots = w.slots.flatMap(sl => {
    if (!t.ix.progressions.has(sl.progression)) return []
    const step = L.currentStep(t.ix, t.state, sl.progression)
    return [{ sl, step, sets: sl.sets ?? step.target.sets }]
  })

  const rename = () => router.push({ pathname: '/workouts/name', params: { id: w.id } })
  const remove = async () => {
    if (L.workoutsInWeekOrder(t.ix).length <= 1) {
      await ask({ title: tr('editor.lastTitle'), message: tr('editor.lastMessage'), ok: tr('editor.ok') })
      return
    }
    if (!await ask({ title: tr('editor.deleteTitle', { name: w.name }), message: tr('editor.deleteMessage'), ok: tr('editor.delete'), destructive: true })) return
    // erst zurück, dann löschen – sonst zeigt die Seite kurz ein leeres Workout
    router.back()
    t.editPlan(p => L.withoutWorkout(p, w.id))
  }

  return (
    <>
      <ModalToolbar close={first} menuLabel={tr('editor.more')} menu={[
        { title: tr('editor.rename'), icon: 'edit', onPress: rename },
        { title: tr('editor.delete'), icon: 'trash', destructive: true, onPress: () => void remove() },
      ]} />
      <SheetScreen title={w.name} sub={`${w.focus} · ${exerciseCount(slots.length)}`}
        footer={slots.length > 0 || L.circuitsOf(w).length > 0 ? <Button variant="primary" size="lg" icon="play" disabled={busy}
          title={t.active?.workout === w.id ? tr('home.ctaActive') : tr('editor.startNow')} onPress={start} /> : undefined}>
        <Section title={tr('editor.exercisesHead')} />
        <Text variant="small">{tr('editor.exercisesHint')}</Text>
        {!slots.length && <Text variant="muted">{tr('editor.empty')}</Text>}
        {slots.length > 0 && <Rows rows={slots.map(({ sl, step, sets }) => ({
          key: sl.progression, title: step.exercise.name, exercise: step.exercise,
          subtitle: `${tn('editor.setsN', sets)} à ${step.target.label.replace(/^\d+\s*×\s*/, '')} · ${tr('editor.stage', { stage: step.index + 1, total: step.total })}`,
          onPress: () => router.push({ pathname: '/workouts/slot', params: { id: w.id, pid: sl.progression } }),
        }))} />}
        <Button icon="plus" title={tr('editor.addExercise')} onPress={() => router.push({ pathname: '/workouts/add', params: { id: w.id } })} />

        {/* Runden-Blöcke (z. B. Cindy): feste Übungen, unabhängig von den Leiterstufen */}
        <Section title={tr('editor.circuits')} />
        <Text variant="small">{tr('editor.circuitsHint')}</Text>
        {L.circuitsOf(w).length > 0 && <Rows rows={L.circuitsOf(w).map(c => ({
          key: c.id, title: L.fmtCircuitRule(c), icon: 'sync' as const, iconTile: true,
          subtitle: L.fmtCircuitItems(t.ix, c),
          onPress: () => router.push({ pathname: '/workouts/circuit', params: { id: w.id, cid: c.id } }),
        }))} />}
        <Button icon="plus" title={tr('editor.addCircuit')} onPress={() => router.push({ pathname: '/workouts/circuit', params: { id: w.id, cid: 'new' } })} />

        <Section title={tr('editor.weekdays')} />
        <DayPicker onToggle={(d, on) => void setDay(d as Weekday, on)} items={L.WEEK_ORDER.map(d => ({
          id: d, short: L.WEEKDAY_SHORT[d], long: DAY_NAME[d], on: weekplan[d] === w.id,
          taken: !!other(d), hint: other(d) ? tr('editor.instead', { name: other(d)! }) : undefined,
        }))} />
        <Text variant="small">{L.WEEK_ORDER.some(d => weekplan[d] !== w.id && other(d))
          ? tr('editor.takenHint', { list: L.WEEK_ORDER.filter(d => weekplan[d] !== w.id && other(d)).map(d => `${L.WEEKDAY_SHORT[d]} ${other(d)}`).join(' · ') })
          : tr('editor.weekdaysHint')}</Text>

        <View style={{ marginTop: 16 }}>
          <ButtonRow>
            <Button style={{ flex: 1 }} icon="edit" title={tr('editor.rename')} onPress={rename} />
            <Button style={{ flex: 1 }} variant="danger" icon="trash" title={tr('editor.delete')} onPress={() => void remove()} />
          </ButtonRow>
        </View>
      </SheetScreen>
    </>
  )
}
