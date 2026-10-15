/* Konto & Sync: abgemeldet der Anmeldebereich (screens/auth), angemeldet Status, Abgleich,
   Abmelden, Konto löschen. */
import { useEffect, useState } from 'react'
import * as AppleAuthentication from 'expo-apple-authentication'
import { HEALTH_CONSENT } from '@lever/core/consent.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { UnsyncedError, type Training } from '@lever/core/useTraining.ts'
import { ask, Button, Card, color, ListGroup, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { SignInScreen } from '@/screens/auth'
import { fmtSync, manualSync, syncStatus } from './shared'

export { openPrivacy } from '@/screens/auth'

/** Konto löschen nach Rückfrage; Fehler als Toast */
export async function confirmDeleteAccount(t: Training) {
  const email = t.sync.account?.email
  if (!email) return
  if (!await ask({ title: tr('profile.deleteAsk.title'), message: tr('profile.deleteAsk.message', { email }), ok: tr('profile.deleteAccount'), destructive: true })) return
  try { await t.deleteAccount() } catch (e) { toast(tr('profile.deleteFailed', { msg: (e as Error).message }), 'error') }
}

export function AccountPage({ gate }: { gate?: boolean } = {}) {
  const { t } = useApp()
  const s = t.sync
  const [err, setErr] = useState<string | null>(null)

  if (s.account) {
    const syncing = s.phase === 'syncing'
    const signOut = async () => {
      if (!await ask({ title: tr('profile.signOutAsk.title'), message: tr('profile.signOutAsk.message'), ok: tr('profile.signOut') })) return
      try { await t.signOut() }
      catch (e) {
        if (!(e instanceof UnsyncedError)) { toast((e as Error).message, 'error'); return }
        if (await ask({ title: tr('profile.signOutUnsynced.title'), message: tr('profile.signOutUnsynced.message', { n: e.pending }), ok: tr('profile.signOutUnsynced.ok'), destructive: true }))
          await t.signOut({ force: true }).catch(x => toast((x as Error).message, 'error'))
      }
    }
    return (
      <SheetScreen title={tr('profile.sync.title')} sub={`${tr('profile.sync.signedInAs')} ${s.account.email}`}>
        <Card>
          <Text variant="label" style={{ color: s.phase === 'error' ? color.danger : color.text }}>{syncStatus(s)}</Text>
          <Text variant="small">{tr('profile.sync.last', { when: fmtSync(s.lastSync) })}</Text>
          {s.phase !== 'error' && s.error ? <Text variant="small" style={{ color: color.danger }}>{tr('profile.sync.rejected', { msg: s.error })}</Text> : null}
          <Button icon="sync" title={syncing ? tr('profile.sync.syncing') : tr('profile.syncNow')} busy={syncing} onPress={() => void manualSync(t)} style={{ marginTop: 6 }} />
        </Card>
        {s.consentMissing && (
          <Card>
            <Text variant="body" style={{ color: color.danger }}>{tr('profile.consentPaused')}</Text>
            <Button variant="primary" title={HEALTH_CONSENT.ok} onPress={() => void t.acceptHealthConsent().catch(e => setErr((e as Error).message))} />
          </Card>
        )}
        {err && <Text variant="muted" style={{ color: color.danger }} accessibilityLiveRegion="polite">{err}</Text>}
        <AppleLink />
        <ListGroup rows={[{ title: tr('profile.signOut'), icon: 'signOut', onPress: () => void signOut() }]} />
        <ListGroup rows={[{ title: tr('profile.deleteAccount'), icon: 'trash', danger: true, onPress: () => void confirmDeleteAccount(t) }]} />
      </SheetScreen>
    )
  }

  return <SignInScreen gate={gate} />
}

/** Apple-ID mit dem Konto verknüpfen: danach führt „Mit Apple fortfahren“ hierher – auch mit
    verborgener E-Mail-Adresse (die Apple sonst als neues Konto behandeln würde) */
function AppleLink() {
  const { t } = useApp()
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => setAvailable(false)) }, [])
  if (!available || !t.sync.account) return null
  const linked = !!t.sync.account.apple
  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)
    try { await fn(); toast(done, 'success') } catch (e) { if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const link = () => run(async () => {
    const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL] })
    if (!cred.identityToken) throw Object.assign(new Error(''), { code: 'ERR_REQUEST_CANCELED' })
    await t.setAppleLink(cred.identityToken)
  }, tr('profile.appleLinked'))
  const unlink = async () => {
    if (!await ask({ title: tr('profile.appleUnlinkAsk.title'), message: tr('profile.appleUnlinkAsk.message'), ok: tr('profile.appleUnlink'), destructive: true })) return
    await run(() => t.setAppleLink(null), tr('profile.appleUnlinked'))
  }
  return (
    <ListGroup rows={[linked
      ? { title: tr('profile.appleRow'), subtitle: tr('profile.appleRowLinked'), icon: 'apple', trailing: busy ? '…' : tr('profile.appleUnlink'), onPress: () => void unlink() }
      : { title: tr('profile.appleLink'), subtitle: tr('profile.appleLinkSub'), icon: 'apple', trailing: busy ? '…' : undefined, onPress: () => void link() }]} />
  )
}
