/* Onboarding: Bedingung (wie needsOnboarding im Web), „erledigt“-Merker pro Gerät und Schließen
   des ganzen Onboarding-Modals von jeder Schrittseite aus. */
import { useNavigation } from 'expo-router'
import { DISCLAIMER_VERSION } from '@lever/core/consent.ts'
import { platform } from '@lever/core/platform.ts'
import type { Training } from '@lever/core/useTraining.ts'

const DONE = 'lever-onboarded'
export const isOnboarded = () => platform().prefs.get(DONE) === '1'
export const markOnboarded = () => platform().prefs.set(DONE, '1')

/** Nur bei frischer Installation: keine Einheiten, kein Profil, kein eigener Plan – und erst nach dem Gesundheits-Hinweis */
export const needsOnboarding = (t: Training) =>
  t.loaded && !t.sessions.length && !t.state.profile && !t.plan && t.consent.disclaimer === DISCLAIMER_VERSION && !isOnboarded()

/** Onboarding als erledigt merken und das Modal schließen – nur diese Route im Root-Stack, auch
    wenn darüber noch etwas liegt (POP mit source entfernt genau sie). */
export function useFinishOnboarding() {
  const root = useNavigation('/')
  return () => {
    markOnboarded()
    const st = root.getState()
    const route = st?.routes.find(r => r.name === 'onboarding')
    if (st && route) root.dispatch({ type: 'POP', payload: { count: 1 }, source: route.key, target: st.key })
  }
}
