/* Konto & Sync: abgemeldet das Anmeldeformular (native Felder mit AutoFill, Einwilligung als
   Häkchen), angemeldet Status, Abgleich, Abmelden, Konto löschen. (Web: DataView › Account) */
import { useRef, useState } from 'react'
import { View, type TextInputInstance } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { HEALTH_CONSENT, PRIVACY_URL } from '@lever/core/consent.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { UnsyncedError, type Training } from '@lever/core/useTraining.ts'
import { ask, Button, Card, Choices, color, ListGroup, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { Field } from './parts'
import { fmtSync, manualSync, syncStatus } from './shared'

export const openPrivacy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pwRef = useRef<TextInputInstance>(null)

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
        <ListGroup rows={[{ title: tr('profile.signOut'), icon: 'signOut', onPress: () => void signOut() }]} />
        <ListGroup rows={[{ title: tr('profile.deleteAccount'), icon: 'trash', danger: true, onPress: () => void confirmDeleteAccount(t) }]} />
      </SheetScreen>
    )
  }

  const signIn = async () => {
    if (!agree) { setErr(tr('profile.agreeFirst')); return }
    if (!email.trim() || !password) return
    setBusy(true); setErr(null)
    try { await t.signIn(email.trim(), password, agree); setPassword('') }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <SheetScreen title={gate ? tr('profile.gateTitle') : tr('profile.signIn')}
      sub={`${s.phase === 'offline' ? tr('profile.offlineSignIn') : ''}${gate ? tr('profile.gateSub') : tr('profile.signInHint')}`}
      footer={<Button variant="primary" size="lg" title={busy ? tr('profile.signingIn') : tr('profile.signIn')} busy={busy}
        disabled={!agree || !email.trim() || !password} onPress={() => void signIn()} />}>
      <Field label={tr('profile.email')} value={email} onChangeText={setEmail}
        keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => pwRef.current?.focus()} />
      <Field ref={pwRef} label={tr('profile.password')} value={password} onChangeText={setPassword}
        secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" autoCorrect={false}
        returnKeyType="go" onSubmitEditing={() => void signIn()} />
      <View style={{ marginTop: 4 }}>
        <Choices items={[{ id: 'agree', title: HEALTH_CONSENT.short, on: agree }]} onToggle={(_, on) => { setAgree(on); if (on) setErr(null) }} />
      </View>
      <Button variant="ghost" icon="privacy" title={tr('common.privacy')} onPress={openPrivacy} />
      {err && <Text variant="muted" style={{ color: color.danger }} accessibilityLiveRegion="polite">{err}</Text>}
      {gate && <Text variant="small">{tr('profile.gateNoAccount')}</Text>}
    </SheetScreen>
  )
}
