/* Onboarding › Tage & Dauer – mit Zielen weiter zum Planvorschlag, sonst fertig (Standardplan) */
import { router } from 'expo-router'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { DaysPage } from '@/screens/profile/days'
import { OnboardingClose } from '@/screens/onboarding/close'
import { useFinishOnboarding } from '@/screens/onboarding/state'

export default function Screen() {
  const { ps } = useApp()
  const finish = useFinishOnboarding()
  const suggest = ps.hasGoals && !!ps.suggestion
  return (
    <>
      <OnboardingClose />
      <DaysPage next={suggest
        ? { title: tr('onboarding.suggest'), onNext: () => router.push('/onboarding/suggestion') }
        : { title: tr('common.done'), onNext: finish }} />
    </>
  )
}
