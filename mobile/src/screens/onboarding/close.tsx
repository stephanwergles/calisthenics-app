/* Schließen-Button (Glas, oben rechts) auf den Onboarding-Schritten: beendet das Onboarding,
   bisherige Eingaben bleiben. */
import { CloseButton } from '@/navigation'
import { useFinishOnboarding } from './state'

export function OnboardingClose() {
  const finish = useFinishOnboarding()
  return <CloseButton onPress={finish} />
}
