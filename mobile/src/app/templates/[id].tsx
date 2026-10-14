/* Eine Vorlage (Push-Seite in der Bibliothek). Plan übernehmen = neue Planversion nach Rückfrage
   (rückgängig im Plan-Tab); Workout = Kopie unter „Meine Workouts“, auf Wunsch gleich für heute.
   Nach dem Übernehmen schließt die Bibliothek (im Onboarding: zurück dorthin). (Web: TemplatePage) */
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import type { Template } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { useApp } from '@/state/app'
import { ask, Button, SheetScreen, Text } from '@/ui'
import { DAY_NAME, Notice, Rows, Section, useCloseModal } from '@/screens/plan/parts'
import { templateGear, templateMeta } from '@/screens/plan/templates'

export default function TemplateScreen() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const tpl = catalogData(t.ix.catalog).templates.find(x => x.id === id)
  if (!tpl) return <SheetScreen title={tr('plan.templates.title')} />
  return <TemplatePage tpl={tpl} />
}

function TemplatePage({ tpl }: { tpl: Template }) {
  const { t, ps } = useApp()
  const close = useCloseModal()
  const [added, setAdded] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const profileDays = L.profileOf(t.ix, t.state).days
  const plan = useMemo(
    () => (tpl.kind === 'plan' ? L.planFromTemplate(t.ix, t.plan ?? L.planFromCatalog(t.baseCatalog), tpl, profileDays) : null),
    [tpl, t.ix, t.plan, t.baseCatalog, profileDays],
  )
  const changes = useMemo(
    () => (plan ? L.planDiff(t.ix, t.state, plan).reduce((n, d) => n + d.changes.filter(c => c.kind !== 'bleibt').length, 0) : 0),
    [plan, t.ix, t.state],
  )
  const dayOf = (wid: string) => (plan ? L.WEEK_ORDER.filter(d => plan.weekplan[d] === `${tpl.id}-${wid}`).map(d => DAY_NAME[d]).join(', ') : '')
  const exercises = (w: Template['workouts'][number]) => w.slots.filter(s => t.ix.progressions.has(s.progression)).map(s => {
    const step = L.currentStep(t.ix, t.state, s.progression)
    return { pid: s.progression, exercise: step.exercise, sets: s.sets ?? step.target.sets }
  })

  const applyPlan = async () => {
    if (!plan || busy) return
    setBusy(true)
    const ok = await ask({ title: tr('plan.templates.applyTitle', { name: tpl.name }), message: tn('plan.templates.applyMessage', changes), ok: tr('plan.templates.applyOk') })
    setBusy(false)
    if (!ok) return
    ps.apply(plan)
    close()
  }
  const addWorkout = (today: boolean) => {
    const w = L.workoutFromTemplate(t.ix, tpl)
    t.editPlan(p => L.withWorkout(p, w))
    toast(tr('common.toast.workoutAdded'), 'success')
    if (today) { t.chooseWorkout(w.id); close() } else setAdded(w.name)
  }

  return (
    <SheetScreen title={tpl.name} sub={`${templateMeta(tpl)} · ${templateGear(tpl)}`}
      footer={tpl.kind === 'plan'
        ? <Button variant="primary" size="lg" icon="check" title={tr('plan.templates.applyPlan')} busy={busy} onPress={() => void applyPlan()} />
        : <>
            <Button variant="primary" size="lg" icon="play" title={tr('plan.templates.trainToday')} onPress={() => addWorkout(true)} />
            <Button icon="plus" title={tr('plan.templates.addToMine')} onPress={() => addWorkout(false)} />
          </>}>
      <Text variant="body">{tpl.description}</Text>
      {added && <Notice text={tr('plan.templates.added', { name: added })} />}
      {tpl.workouts.map(w => {
        const days = tpl.kind === 'plan' ? dayOf(w.id) : ''
        return (
          <View key={w.id} style={{ gap: 8 }}>
            <Section title={tpl.kind === 'plan' ? `${w.name}${days ? ` · ${days}` : ''}` : tr('plan.templates.exercises')} />
            <Rows rows={exercises(w).map(x => ({
              key: x.pid, title: x.exercise.name, exercise: x.exercise,
              trailing: tn('plan.templates.sets', x.sets),
            }))} />
          </View>
        )
      })}
      {plan && (
        <Text variant="small" style={{ marginTop: 8 }}>
          {tn('plan.templates.applyNote', changes, { days: profileDays.length === (tpl.days ?? 0) ? tr('plan.templates.applyNoteDays') : '' })}
        </Text>
      )}
    </SheetScreen>
  )
}
