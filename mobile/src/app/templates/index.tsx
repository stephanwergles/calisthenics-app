/* Vorlagen-Bibliothek: Plan- und Workout-Vorlagen, jede Vorlage als Push-Seite (templates/[id]).
   Onboarding: /templates?plansOnly=1&from=onboarding → nur Pläne. (Web: TemplatesSheet) */
import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { Template } from '@lever/domain/model.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Card, color, font, Icon, Segmented, SheetScreen, Text } from '@/ui'
import { ModalToolbar, useIsFirst } from '@/screens/plan/parts'
import { templateMeta } from '@/screens/plan/templates'

export default function TemplatesScreen() {
  const { t } = useApp()
  const { plansOnly } = useLocalSearchParams<{ plansOnly?: string; from?: string }>()
  const onlyPlans = plansOnly === '1' || plansOnly === 'true'
  const [kind, setKind] = useState<Template['kind']>('plan')
  const first = useIsFirst()
  const list = catalogData(t.ix.catalog).templates.filter(x => x.kind === (onlyPlans ? 'plan' : kind))

  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={onlyPlans ? tr('plan.templates.titlePlans') : tr('plan.templates.title')} sub={tr('plan.templates.sub')}>
        {!onlyPlans && (
          <Segmented label={tr('plan.templates.kindAria')} value={kind} onChange={setKind}
            options={[{ id: 'plan', title: tr('plan.templates.plans') }, { id: 'workout', title: tr('plan.templates.workouts') }]} />
        )}
        <View style={{ gap: 10, marginTop: 4 }}>
          {list.map(x => (
            <Card key={x.id} label={`${x.name}, ${templateMeta(x)}`} style={{ gap: 6 }}
              onPress={() => router.push({ pathname: '/templates/[id]', params: { id: x.id } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text variant="title" style={{ flex: 1 }}>{x.name}</Text>
                <Icon name="right" size={14} color={color.muted} />
              </View>
              <Text variant="muted">{x.description}</Text>
              <Text variant="small" style={{ fontFamily: font.bodySemi, color: color.accent }}>{templateMeta(x)}</Text>
            </Card>
          ))}
        </View>
      </SheetScreen>
    </>
  )
}
