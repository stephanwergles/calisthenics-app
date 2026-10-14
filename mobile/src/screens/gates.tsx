/* Automatisch geöffnete Bereiche (Web: ConsentGate, Onboarding in TrainingApp):
   1. Gesundheits-Hinweis beim ersten Start (/consent, nicht wegwischbar)
   1b. Anmeldung (Pflicht, /signin) – solange kein Konto da ist, öffnet sich nichts anderes
   2. Einwilligung Gesundheitsdaten, wenn angemeldet und sie fehlt (/consent?kind=health, „Später“
      gilt bis zum nächsten App-Start)
   3. danach Onboarding bei frischer Installation (Bedingung needsOnboarding)
   4. läuft beim Start eine Session (App mitten im Training beendet) → direkt zurück ins Training
   Jede Route öffnet sich höchstens einmal pro App-Start, sobald die Navigation bereit ist und
   gerade kein anderer dieser Bereiche offen ist. */
import { useEffect, useRef, useState } from 'react'
import { router, usePathname, useRootNavigationState, type Href } from 'expo-router'
import { DISCLAIMER_VERSION, HEALTH_CONSENT_VERSION } from '@lever/core/consent.ts'
import { useApp } from '@/state/app'
import { needsOnboarding } from '@/screens/onboarding/state'

let later = false
let devSkip = false
const listeners = new Set<() => void>()
/** nur Entwicklung: ohne Konto weiter (bis zum nächsten App-Start) */
export function skipSignIn() { devSkip = true; listeners.forEach(l => l()) }
/** „Später“ bei der Einwilligung: bis zum nächsten App-Start nicht mehr fragen */
export function laterHealthConsent() { later = true; listeners.forEach(l => l()) }

export function Gates() {
  const { t } = useApp()
  const nav = useRootNavigationState()
  const path = usePathname()
  const [, rerender] = useState(0)
  const opened = useRef(new Set<string>())
  useEffect(() => { const l = () => rerender(n => n + 1); listeners.add(l); return () => { listeners.delete(l) } }, [])

  const ready = !!nav?.key && t.loaded
  // nur eine Session, die schon beim Start lief, öffnet das Training automatisch
  const resume = useRef<boolean | null>(null)
  if (t.loaded && resume.current === null) resume.current = !!t.active
  const disclaimer = t.consent.disclaimer !== DISCLAIMER_VERSION
  const health = !disclaimer && !!t.sync.account && t.consent.health !== HEALTH_CONSENT_VERSION && !later
  const signIn = !disclaimer && !t.sync.account && !devSkip
  const onboarding = needsOnboarding(t)
  const busy = path.startsWith('/consent') || path.startsWith('/onboarding') || path.startsWith('/signin')

  useEffect(() => {
    if (!ready || busy) return
    const want: [string, Href] | null = disclaimer ? ['disclaimer', '/consent']
      : signIn ? ['signin', '/signin' as Href]
      : health ? ['health', '/consent?kind=health' as Href]
      : onboarding ? ['onboarding', '/onboarding']
      : resume.current && t.active ? ['training', '/training']
      : null
    // Anmeldung nach dem Abmelden erneut – sie ist Pflicht
    if (want?.[0] === 'signin') opened.current.delete('signin')
    if (!want || opened.current.has(want[0])) return
    // kurz warten: ein gerade geschlossenes Modal soll erst verschwinden
    const id = setTimeout(() => { opened.current.add(want[0]); router.push(want[1]) }, 450)
    return () => clearTimeout(id)
  }, [ready, busy, disclaimer, signIn, health, onboarding])
  return null
}
