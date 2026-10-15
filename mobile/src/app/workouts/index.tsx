/* Meine Workouts (Übersicht): alle Workouts mit ihren Wochentagen, neues anlegen. Die Woche selbst
   (welcher Tag welches Workout) gehört zum Plan und steht im Plan-Tab.
   Jede Änderung gilt sofort (t.editPlan). (Web: PlanEditor → WorkoutsSheet)
   pick: aus dem Start-Flow (Ruhetag „Doch trainieren“) – Workout wählen und starten, Workouts öffnen
   nur zum Ansehen (Bearbeiten weiter über deren Menü), kein „Neues Workout“. */
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, SheetScreen } from '@/ui'
import { ModalToolbar, Rows, useIsFirst } from '@/screens/plan/parts'
import { daysOf, workoutSize } from '@/screens/plan/workouts'

export default function WorkoutsScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const pick = useLocalSearchParams<{ pick?: string }>().pick === '1'
  const list = L.workoutsInWeekOrder(t.ix)
  const open = (id: string) => router.push({ pathname: '/workouts/[id]', params: { id, ...(pick ? { view: '1' } : {}) } })

  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={pick ? tr('editor.pickTitle') : tr('editor.myWorkouts')} sub={pick ? tr('editor.pickSub') : t.plan ? tr('editor.subOwn') : tr('editor.subDefault')}>
        <Rows rows={list.map(w => ({
          key: w.id, title: w.name, subtitle: [w.focus, workoutSize(w)].filter(Boolean).join(' · '),
          trailing: daysOf(t, w.id) || tr('editor.noDay'), onPress: () => open(w.id),
        }))} />
        {!pick && <Button icon="plus" title={tr('editor.newWorkout')} onPress={() => open('new')} />}
      </SheetScreen>
    </>
  )
}
