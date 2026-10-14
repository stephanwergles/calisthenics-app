/* Wochentag belegen (Plan-Tab: Tipp auf einen Ruhetag): Workout oder Ruhetag wählen.
   (Web: PlanEditor → DayAssign) */
import { router, useLocalSearchParams } from 'expo-router'
import type { Weekday, WorkoutId } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Choices, SheetScreen } from '@/ui'
import { DAY_NAME, ModalToolbar, useIsFirst } from '@/screens/plan/parts'
import { exerciseCount } from '@/screens/plan/workouts'

const REST = '__rest'

export default function DayScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const param = useLocalSearchParams<{ day: string }>().day as Weekday
  const day: Weekday = L.WEEK_ORDER.includes(param) ? param : L.WEEK_ORDER[0]
  const current = t.ix.catalog.weekplan[day]
  const pick = (id: WorkoutId | undefined) => {
    if (id !== current) t.editPlan(p => L.withDay(p, day, id))
    router.back()
  }
  const items = [
    ...L.workoutsInWeekOrder(t.ix).map(w => ({ id: w.id as string, title: w.name, sub: `${w.focus} · ${exerciseCount(w.slots.length)}`, on: current === w.id })),
    { id: REST, title: tr('editor.restDay'), on: !current },
  ]
  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={DAY_NAME[day]} sub={tr('editor.dayQuestion')}>
        <Choices mode="radio" items={items} onToggle={id => pick(id === REST ? undefined : id)} />
      </SheetScreen>
    </>
  )
}
