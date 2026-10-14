/* Onboarding › Ausrüstung (dieselbe Seite wie im Profil, mit Weiter-Fußzeile) */
import { router } from 'expo-router'
import { t as tr } from '@lever/core/i18n/index.ts'
import { EquipmentPage } from '@/screens/profile/equipment'
import { OnboardingClose } from '@/screens/onboarding/close'

export default function Screen() {
  return <><OnboardingClose /><EquipmentPage next={{ title: tr('common.next'), onNext: () => router.push('/onboarding/days') }} /></>
}
