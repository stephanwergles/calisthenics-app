/* Meine Workouts (Übersicht): alle Workouts mit ihren Wochentagen, neues anlegen. Die Woche selbst
   (welcher Tag welches Workout) gehört zum Plan und steht im Plan-Tab.
   Jede Änderung gilt sofort (t.editPlan). (Web: PlanEditor → WorkoutsSheet) */
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, SheetScreen } from '@/ui'
import { ModalToolbar, Rows, useIsFirst } from '@/screens/plan/parts'
import { daysOf, workoutSize } from '@/screens/plan/workouts'

export default function WorkoutsScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const list = L.workoutsInWeekOrder(t.ix)
  const open = (id: string) => router.push({ pathname: '/workouts/[id]', params: { id } })

  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={tr('editor.myWorkouts')} sub={t.plan ? tr('editor.subOwn') : tr('editor.subDefault')}>
        <Rows rows={list.map(w => ({
          key: w.id, title: w.name, subtitle: [w.focus, workoutSize(w)].filter(Boolean).join(' · '),
          trailing: daysOf(t, w.id) || tr('editor.noDay'), onPress: () => open(w.id),
        }))} />
        <Button icon="plus" title={tr('editor.newWorkout')} onPress={() => open('new')} />
      </SheetScreen>
    </>
  )
}
