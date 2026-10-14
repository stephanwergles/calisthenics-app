/* Onboarding – Willkommen: zwei Wege zum Plan (aus den Zielen oder fertiger Plan), oder
   überspringen. Wird über die Vorlagen ein Plan übernommen, schließt sich das Onboarding, sobald
   es wieder sichtbar ist. (Web: Onboarding) */
import { useEffect } from 'react'
import { View } from 'react-native'
import { router, useIsFocused, type Href } from 'expo-router'
import { t as tr } from '@lever/core/i18n/index.ts'
import { Button, LeverMark, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { useFinishOnboarding } from './state'

export function OnboardingWelcome() {
  const { t } = useApp()
  const finish = useFinishOnboarding()
  const focused = useIsFocused()
  // fertigen Plan gewählt (Vorlagen) → zurück hier = fertig
  useEffect(() => { if (focused && t.plan) finish() }, [focused, t.plan]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SheetScreen title={tr('onboarding.title')} sub={tr('onboarding.subtitle')}
      footer={<>
        <Button variant="primary" size="lg" icon="arrowRight" title={tr('onboarding.fromGoals')} onPress={() => router.push('/onboarding/assessment')} />
        <Button variant="secondary" icon="grid" title={tr('onboarding.library')} onPress={() => router.push('/templates?plansOnly=1&from=onboarding' as Href)} />
        <Button variant="ghost" title={tr('onboarding.skip')} onPress={finish} />
      </>}>
      <View style={{ alignItems: 'center', paddingVertical: 28 }}>
        <LeverMark height={96} level={0} />
      </View>
      <Text variant="body">{tr('onboarding.intro')}</Text>
    </SheetScreen>
  )
}
