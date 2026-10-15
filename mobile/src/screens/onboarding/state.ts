/* Onboarding: Bedingung, „erledigt“-Merker pro Konto (nicht pro Gerät – ein neues Konto auf einem
   schon benutzten iPhone soll es auch bekommen) und Schließen des ganzen Onboarding-Modals. */
import { useNavigation } from 'expo-router'
import { DISCLAIMER_VERSION } from '@lever/core/consent.ts'
import { platform } from '@lever/core/platform.ts'
import type { Training } from '@lever/core/useTraining.ts'
import { useApp } from '@/state/app'

const key = (t: Training) => `lever-onboarded:${t.sync.account?.id ?? 'local'}`
export const isOnboarded = (t: Training) => platform().prefs.get(key(t)) === '1'
export const markOnboarded = (t: Training) => platform().prefs.set(key(t), '1')

/** Neues Konto: noch keine Einheiten, kein Profil, kein eigener Plan – erst nach dem ersten Abgleich
    (vorher wüsste die App nicht, ob der Server schon etwas hat) und nach dem Gesundheits-Hinweis */
export const needsOnboarding = (t: Training) =>
  t.loaded && (!t.sync.account || !!t.sync.lastSync) && !t.sessions.length && !t.state.profile && !t.plan
  && t.consent.disclaimer === DISCLAIMER_VERSION && !isOnboarded(t)

/** Onboarding als erledigt merken und das Modal schließen – nur diese Route im Root-Stack, auch
    wenn darüber noch etwas liegt (POP mit source entfernt genau sie). */
export function useFinishOnboarding() {
  const root = useNavigation('/')
  const { t } = useApp()
  return () => {
    markOnboarded(t)
    const st = root.getState()
    const route = st?.routes.find(r => r.name === 'onboarding')
    if (st && route) root.dispatch({ type: 'POP', payload: { count: 1 }, source: route.key, target: st.key })
  }
}
