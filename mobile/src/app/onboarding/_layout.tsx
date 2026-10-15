/* Onboarding: Modal mit eigenem Stack – Willkommen → Einstufung → Ziele → Ausrüstung → Tage →
   Planvorschlag als Push-Seiten (Zurück-Wischen geht einen Schritt zurück). Entsteht unterwegs
   ein Plan (Vorschlag oder Vorlage), gilt das Onboarding als erledigt. */
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'
import { useApp } from '@/state/app'
import { markOnboarded } from '@/screens/onboarding/state'

export default function Layout() {
  const { t } = useApp()
  useEffect(() => { if (t.plan) markOnboarded(t) }, [t.plan]) // eslint-disable-line react-hooks/exhaustive-deps
  return <Stack screenOptions={stackScreenOptions} />
}
