/* Konto & Sync: abgemeldet Anmelden/Registrieren (Sign in with Apple, E-Mail mit AutoFill,
   Passwort vergessen, Einwilligung als Häkchen), angemeldet Status, Abgleich, Abmelden, Konto löschen. */
import { useEffect, useRef, useState } from 'react'
import { View, type TextInputInstance } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
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
        <ListGroup rows={[{ title: tr('profile.signOut'), icon: 'signOut', onPress: () => void signOut() }]} />
        <ListGroup rows={[{ title: tr('profile.deleteAccount'), icon: 'trash', danger: true, onPress: () => void confirmDeleteAccount(t) }]} />
      </SheetScreen>
    )
  }

  return <SignedOut gate={gate} />
}

type Mode = 'signin' | 'register' | 'forgot' | 'check'
const MIN_PASSWORD = 8

/** abgemeldet: Sign in with Apple, darunter E-Mail – Anmelden, Registrieren (dann „Postfach prüfen“),
    Passwort vergessen. Die Einwilligung (Gesundheitsdaten) gilt für alle Wege. */
function SignedOut({ gate }: { gate?: boolean }) {
  const { t } = useApp()
  const s = t.sync
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [appleOk, setAppleOk] = useState(false)
  const pwRef = useRef<TextInputInstance>(null)
  useEffect(() => { void AppleAuthentication.isAvailableAsync().then(setAppleOk).catch(() => setAppleOk(false)) }, [])
  const go = (m: Mode) => { setMode(m); setErr(null) }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null)
    try { await fn() } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  const needAgree = () => { if (!agree) { setErr(tr('profile.agreeFirst')); return true } return false }
  const signIn = () => {
    if (needAgree() || !email.trim() || !password) return
    void run(async () => { await t.signIn(email.trim(), password, agree); setPassword('') })
  }
  const register = () => {
    if (needAgree() || !email.trim()) return
    if (password.length < MIN_PASSWORD) { setErr(tr('profile.passwordShort')); return }
    void run(async () => { await t.register(email.trim(), password); setPassword(''); go('check') })
  }
  const forgot = () => {
    if (!email.trim()) return
    void run(async () => { await t.forgotPassword(email.trim()); toast(tr('profile.forgotSent'), 'success'); go('signin') })
  }
  const apple = async () => {
    if (needAgree()) return
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      })
      if (!cred.identityToken) return
      await run(() => t.signInWithApple(cred.identityToken!, agree))
    } catch (x) {
      // abgebrochen ist kein Fehler
      if ((x as { code?: string }).code !== 'ERR_REQUEST_CANCELED') setErr((x as Error).message)
    }
  }

  const errorText = err && <Text variant="muted" style={{ color: color.danger }} accessibilityLiveRegion="polite">{err}</Text>
  const emailField = (next?: () => void) => (
    <Field label={tr('profile.email')} value={email} onChangeText={setEmail}
      keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
      returnKeyType={next ? 'next' : 'go'} submitBehavior={next ? 'submit' : undefined} onSubmitEditing={next ?? forgot} />
  )
  const consent = (
    <>
      <View style={{ marginTop: 4 }}>
        <Choices items={[{ id: 'agree', title: HEALTH_CONSENT.short, on: agree }]} onToggle={(_, on) => { setAgree(on); if (on) setErr(null) }} />
      </View>
      <Button variant="ghost" icon="privacy" title={tr('common.privacy')} onPress={openPrivacy} />
    </>
  )

  if (mode === 'check') return (
    <SheetScreen title={tr('profile.checkTitle')} sub={tr('profile.checkSub', { email: email.trim() })}
      footer={<Button variant="primary" size="lg" title={tr('profile.backToSignIn')} onPress={() => go('signin')} />} />
  )
  if (mode === 'forgot') return (
    <SheetScreen title={tr('profile.forgotTitle')} sub={tr('profile.forgotSub')}
      footer={<Button variant="primary" size="lg" title={tr('profile.forgotSend')} busy={busy} disabled={!email.trim()} onPress={forgot} />}>
      {emailField()}
      {errorText}
      <Button variant="ghost" title={tr('profile.backToSignIn')} onPress={() => go('signin')} />
    </SheetScreen>
  )

  const registering = mode === 'register'
  return (
    <SheetScreen title={registering ? tr('profile.registerTitle') : gate ? tr('profile.gateTitle') : tr('profile.signIn')}
      sub={`${s.phase === 'offline' ? tr('profile.offlineSignIn') : ''}${registering ? tr('profile.registerSub') : gate ? tr('profile.gateSub') : tr('profile.signInHint')}`}
      footer={<Button variant="primary" size="lg" busy={busy} disabled={!agree || !email.trim() || !password}
        title={registering ? (busy ? tr('profile.registering') : tr('profile.register')) : (busy ? tr('profile.signingIn') : tr('profile.signIn'))}
        onPress={registering ? register : signIn} />}>
      {appleOk && (
        <View style={{ gap: 12 }}>
          {/* nativer Apple-Knopf (Pflicht-Gestaltung von Apple), weiß auf dunklem Grund */}
          <AppleAuthentication.AppleAuthenticationButton style={{ height: 52 }} cornerRadius={26}
            buttonType={registering ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} onPress={() => void apple()} />
          <Text variant="small" style={{ textAlign: 'center' }}>{tr('profile.orEmail')}</Text>
        </View>
      )}
      {emailField(() => pwRef.current?.focus())}
      <Field ref={pwRef} label={registering ? tr('profile.passwordNew') : tr('profile.password')} value={password} onChangeText={setPassword}
        secureTextEntry textContentType={registering ? 'newPassword' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'}
        autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={registering ? register : signIn} />
      {consent}
      {errorText}
      <View style={{ gap: 4 }}>
        <Button variant="ghost" title={registering ? tr('profile.toSignIn') : tr('profile.toRegister')} onPress={() => go(registering ? 'signin' : 'register')} />
        {!registering && <Button variant="ghost" title={tr('profile.forgot')} onPress={() => go('forgot')} />}
      </View>
    </SheetScreen>
  )
}
