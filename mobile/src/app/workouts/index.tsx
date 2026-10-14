/* Meine Workouts (Übersicht): alle Workouts mit Wochentagen, neues anlegen, darunter die Woche.
   Jede Änderung gilt sofort (t.editPlan). (Web: PlanEditor → WorkoutsSheet) */
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, SheetScreen } from '@/ui'
import { DAY_NAME, ModalToolbar, Rows, Section, useIsFirst } from '@/screens/plan/parts'
import { daysOf, exerciseCount } from '@/screens/plan/workouts'

export default function WorkoutsScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const list = L.workoutsInWeekOrder(t.ix)
  const week = L.WEEK_ORDER.map(d => ({ d, w: t.ix.catalog.weekplan[d] ? t.ix.workouts.get(t.ix.catalog.weekplan[d]!) : undefined }))
  const open = (id: string) => router.push({ pathname: '/workouts/[id]', params: { id } })

  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={tr('editor.myWorkouts')} sub={t.plan ? tr('editor.subOwn') : tr('editor.subDefault')}>
        <Rows rows={list.map(w => ({
          key: w.id, title: w.name, subtitle: `${w.focus} · ${exerciseCount(w.slots.length)}`,
          trailing: daysOf(t, w.id) || tr('editor.noDay'), onPress: () => open(w.id),
        }))} />
        <Button icon="plus" title={tr('editor.newWorkout')} onPress={() => open('new')} />
        <Section title={tr('editor.week')} />
        <Rows rows={week.map(({ d, w }) => ({
          key: d, title: DAY_NAME[d], trailing: w?.name ?? tr('editor.restDay'),
          onPress: () => (w ? open(w.id) : router.push({ pathname: '/workouts/day', params: { day: d } })),
        }))} />
      </SheetScreen>
    </>
  )
}
