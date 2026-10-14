/* Gesundheits-Hinweis beim ersten Start (nicht wegwischbar, nur „Verstanden“) bzw. mit
   ?kind=health die Einwilligung in die Gesundheitsdaten für angemeldete Konten (mit „Später“).
   Geöffnet von screens/gates.tsx. (Web: ConsentGate) */
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { DISCLAIMER, HEALTH_CONSENT } from '@lever/core/consent.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { Button, ButtonRow, notice, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { openPrivacy } from '@/screens/profile/account'
import { laterHealthConsent } from '@/screens/gates'

export default function Screen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>()
  const { t } = useApp()
  const [busy, setBusy] = useState(false)
  const close = () => { if (router.canDismiss()) router.dismiss(); else router.back() }

  if (kind === 'health') {
    const accept = async () => {
      setBusy(true)
      try { await t.acceptHealthConsent(); close() }
      catch (e) { notice(tr('profile.saveFailed', { msg: (e as Error).message })) }
      finally { setBusy(false) }
    }
    return (
      <SheetScreen title={HEALTH_CONSENT.title} headerSpace={false}
        footer={<ButtonRow>
          <Button variant="secondary" title={tr('common.later')} onPress={() => { laterHealthConsent(); close() }} />
          <Button variant="primary" style={{ flex: 1 }} icon="check" title={HEALTH_CONSENT.ok} busy={busy} onPress={() => void accept()} />
        </ButtonRow>}>
        <Text variant="body">{HEALTH_CONSENT.text}</Text>
        <Button variant="ghost" icon="privacy" title={tr('common.privacy')} onPress={openPrivacy} />
      </SheetScreen>
    )
  }
  return (
    <SheetScreen title={DISCLAIMER.title} headerSpace={false}
      footer={<Button variant="primary" size="lg" icon="check" title={DISCLAIMER.ok} onPress={() => { t.acceptDisclaimer(); close() }} />}>
      <Text variant="body" style={{ fontSize: 17, lineHeight: 25 }}>{DISCLAIMER.text}</Text>
    </SheetScreen>
  )
}
