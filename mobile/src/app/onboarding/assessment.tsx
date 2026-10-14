/* Onboarding › Einstufung (dieselbe Seite wie im Profil, nach dem Speichern weiter) */
import { router } from 'expo-router'
import { AssessmentPage } from '@/screens/profile/assessment'
import { OnboardingClose } from '@/screens/onboarding/close'

export default function Screen() {
  const next = () => router.push('/onboarding/goals')
  return <><OnboardingClose /><AssessmentPage onDone={next} onSkip={next} /></>
}
