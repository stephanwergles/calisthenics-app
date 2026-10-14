/* Workout umbenennen (Push-Seite im Editor). (Web: NameSheet) */
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { SheetScreen } from '@/ui'
import { NameForm } from '@/screens/plan/parts'

export default function RenameScreen() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const w = t.ix.workouts.get(id)
  return (
    <SheetScreen title={tr('editor.rename')} sub={w?.name}>
      {w && <NameForm initial={w.name} ok={tr('editor.save')} onSave={name => {
        t.editPlan(p => L.withWorkout(p, { ...w, name }))
        router.back()
      }} />}
    </SheetScreen>
  )
}
