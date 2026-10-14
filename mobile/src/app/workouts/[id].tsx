/* Workout bearbeiten: Übungen (Tipp → Sätze/Reihenfolge), Übung hinzufügen, Wochentage,
   Umbenennen, Löschen. id = „new“: erst den Namen, dann weiter in den Editor des neuen Workouts.
   (Web: PlanEditor → WorkoutEditor, NameSheet) */
import { Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { Weekday, Workout } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { ask, Button, ButtonRow, color, font, Icon, SheetScreen, Text } from '@/ui'
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
  const { t } = useApp()
  const weekplan = t.ix.catalog.weekplan
  const other = (d: Weekday) => (weekplan[d] && weekplan[d] !== w.id ? t.ix.workouts.get(weekplan[d]!)?.name : undefined)
  const setDay = (d: Weekday, on: boolean) => t.editPlan(p => L.withDay(p, d, on ? w.id : undefined))
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
      <SheetScreen title={w.name} sub={`${w.focus} · ${exerciseCount(slots.length)}`}>
        <Section title={tr('editor.exercisesHead')} />
        {!slots.length && <Text variant="muted">{tr('editor.empty')}</Text>}
        {slots.length > 0 && <Rows rows={slots.map(({ sl, step, sets }) => ({
          key: sl.progression, title: step.exercise.name, exercise: step.exercise,
          subtitle: `${tr('editor.stage', { stage: step.index + 1, total: step.total })} · ${step.target.label.replace(/^\d+\s*×/, `${sets} ×`)}`,
          onPress: () => router.push({ pathname: '/workouts/slot', params: { id: w.id, pid: sl.progression } }),
        }))} />}
        <Button icon="plus" title={tr('editor.addExercise')} onPress={() => router.push({ pathname: '/workouts/add', params: { id: w.id } })} />

        <Section title={tr('editor.weekdays')} />
        {/* kompakte Tagesreihe wie der Wochenstreifen auf Heute: gewählt = Volt mit Haken,
            von einem anderen Workout belegt = Rand + Punkt, frei = gestrichelt */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {L.WEEK_ORDER.map(d => {
            const on = weekplan[d] === w.id, taken = other(d)
            return (
              <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                accessibilityLabel={`${DAY_NAME[d]}${!on && taken ? `, ${tr('editor.instead', { name: taken })}` : ''}`}
                onPress={() => setDay(d, !on)} hitSlop={4} style={{ alignItems: 'center', gap: 6 }}>
                <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', color: on ? color.text : color.muted }}>{L.WEEKDAY_SHORT[d]}</Text>
                <View style={{
                  width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? color.accent : 'transparent',
                  borderWidth: on ? 0 : 1.5, borderStyle: taken ? 'solid' : 'dashed', borderColor: taken ? color.muted : color.line,
                }}>
                  {on ? <Icon name="check" size={18} color={color.onAccent} weight="bold" />
                    : taken ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.muted }} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
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
