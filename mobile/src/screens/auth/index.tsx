/* Anmeldebereich (Route /signin mit eigenem Stack): Anmelden · Registrieren · Passwort vergessen ·
   Postfach prüfen. Wechsel über native Glas-Knöpfe im Kopf (Registrieren rechts, Zurück links),
   Rückmeldungen direkt am Feld. Sign in with Apple oben, E-Mail darunter; die Einwilligung
   (Gesundheitsdaten) gilt für beide Wege. */
import { useEffect, useRef, useState } from 'react'
import { View, type TextInputInstance } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { HEALTH_CONSENT, PRIVACY_URL } from '@lever/core/consent.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { ask, Button, Choices, color, SheetScreen, Text, TextLink } from '@/ui'
import { useApp } from '@/state/app'
import { Field } from '@/screens/profile/parts'
import { skipSignIn } from '@/screens/gates'

const MIN_PASSWORD = 8
export const openPrivacy = () => void WebBrowser.openBrowserAsync(PRIVACY_URL, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
const isCanceled = (x: unknown) => (x as { code?: string }).code === 'ERR_REQUEST_CANCELED'

/** Einwilligung als Häkchen, Fehler direkt darunter, Datenschutz als Link */
function Consent({ agree, onChange, error }: { agree: boolean; onChange: (on: boolean) => void; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      <Choices items={[{ id: 'agree', title: HEALTH_CONSENT.short, on: agree }]} onToggle={(_, on) => onChange(on)} />
      {/* eingerückt auf den Text neben dem Häkchen */}
      <View style={{ paddingLeft: 38, gap: 10 }}>
        {error ? <Text variant="small" style={{ color: color.danger }} accessibilityLiveRegion="polite">{error}</Text> : null}
        <TextLink title={tr('profile.privacyRead')} onPress={openPrivacy} />
      </View>
    </View>
  )
}

/** nativer Apple-Knopf (Gestaltung von Apple vorgegeben) und Trenner zur E-Mail */
function AppleSignIn({ signUp, agree, onAgree }: { signUp?: boolean; agree: boolean; onAgree: () => void }) {
  const { t } = useApp()
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { void AppleAuthentication.isAvailableAsync().then(setOk).catch(() => setOk(false)) }, [])
  if (!ok) return null
  const press = async () => {
    // ohne Häkchen: Einwilligung im Dialog erfragen (nicht das E-Mail-Formular prüfen), dann weiter zu Apple
    if (!agree) {
      if (!await ask({ title: HEALTH_CONSENT.title, message: HEALTH_CONSENT.text, ok: HEALTH_CONSENT.ok })) return
      onAgree()
    }
    setErr(null)
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      })
      if (cred.identityToken) await t.signInWithApple(cred.identityToken, true)
    } catch (x) {
      if (isCanceled(x)) return
      // Apples eigene Meldungen sind englisch und nichtssagend („unknown reason“) – Server-Fehler (deutsch) durchreichen
      setErr((x as { code?: string }).code?.startsWith('ERR_REQUEST') ? tr('profile.appleFailed') : (x as Error).message)
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <AppleAuthentication.AppleAuthenticationButton style={{ height: 52 }} cornerRadius={26}
        buttonType={signUp ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE} onPress={() => void press()} />
      {err ? <Text variant="small" style={{ color: color.danger }} accessibilityLiveRegion="polite">{err}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible={false}>
        <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
        <Text variant="small">{tr('profile.orEmail')}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
      </View>
    </View>
  )
}

/** Glas-Knopf mit Text im Kopf (rechts) */
function HeaderText({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button onPress={onPress} accessibilityLabel={title}>{title}</Stack.Toolbar.Button>
    </Stack.Toolbar>
  )
}

export function SignInScreen({ gate = true }: { gate?: boolean }) {
  const { t } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pwRef = useRef<TextInputInstance>(null)

  const emailErr = tried && !validEmail(email) ? tr('profile.emailInvalid') : null
  const consentErr = tried && !agree ? tr('profile.agreeFirst') : null
  const submit = async () => {
    setTried(true); setErr(null)
    if (!validEmail(email) || !password || !agree) return
    setBusy(true)
    try { await t.signIn(email.trim(), password, agree); setPassword('') }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <>
      <HeaderText title={tr('profile.signUp')} onPress={() => router.push('/signin/register')} />
      <SheetScreen title={gate ? tr('profile.gateTitle') : tr('profile.signIn')}
        sub={`${t.sync.phase === 'offline' ? tr('profile.offlineSignIn') : ''}${gate ? tr('profile.gateSub') : tr('profile.signInHint')}`}
        footer={<Button variant="primary" size="lg" busy={busy} title={busy ? tr('profile.signingIn') : tr('profile.signIn')} onPress={() => void submit()} />}>
        <AppleSignIn agree={agree} onAgree={() => setAgree(true)} />
        <Field label={tr('profile.email')} value={email} onChangeText={setEmail} error={emailErr}
          keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
          returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => pwRef.current?.focus()} />
        <Field ref={pwRef} label={tr('profile.password')} value={password} onChangeText={setPassword}
          error={err ?? (tried && !password ? tr('profile.passwordShort') : null)}
          trailing={<TextLink title={tr('profile.forgot')} label={tr('profile.forgotTitle')} onPress={() => router.push({ pathname: '/signin/forgot', params: { email } })} />}
          secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" autoCorrect={false}
          returnKeyType="go" onSubmitEditing={() => void submit()} />
        <Consent agree={agree} onChange={setAgree} error={consentErr} />
        {__DEV__ && gate && <Button variant="ghost" title={tr('profile.gateDevSkip')} onPress={skipSignIn} />}
      </SheetScreen>
    </>
  )
}

export function RegisterScreen() {
  const { t } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [pwTouched, setPwTouched] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const pwRef = useRef<TextInputInstance>(null)

  const emailErr = (tried && !validEmail(email) ? tr('profile.emailInvalid') : null) ?? (err && /mail/i.test(err) ? err : null)
  const pwErr = (tried || pwTouched) && password.length < MIN_PASSWORD ? tr('profile.passwordShort') : null
  const consentErr = tried && !agree ? tr('profile.agreeFirst') : null
  const submit = async () => {
    setTried(true); setErr(null)
    if (!validEmail(email) || password.length < MIN_PASSWORD || !agree) return
    setBusy(true)
    try {
      await t.register(email.trim(), password)
      router.replace({ pathname: '/signin/check', params: { email: email.trim() } })
    } catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <SheetScreen title={tr('profile.registerTitle')} sub={tr('profile.registerSub')}
      footer={<Button variant="primary" size="lg" busy={busy} title={busy ? tr('profile.registering') : tr('profile.register')} onPress={() => void submit()} />}>
      <AppleSignIn signUp agree={agree} onAgree={() => setAgree(true)} />
      <Field label={tr('profile.email')} value={email} onChangeText={setEmail} error={emailErr}
        keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => pwRef.current?.focus()} />
      <Field ref={pwRef} label={tr('profile.password')} value={password} onChangeText={setPassword} onBlur={() => setPwTouched(!!password)}
        hint={tr('profile.passwordHint')} error={pwErr}
        secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false}
        returnKeyType="go" onSubmitEditing={() => void submit()} />
      <Consent agree={agree} onChange={setAgree} error={consentErr} />
      {err && !/mail/i.test(err) ? <Text variant="small" style={{ color: color.danger }} accessibilityLiveRegion="polite">{err}</Text> : null}
    </SheetScreen>
  )
}

export function ForgotScreen() {
  const { t } = useApp()
  const initial = useLocalSearchParams<{ email?: string }>().email ?? ''
  const [email, setEmail] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    setTried(true); setErr(null)
    if (!validEmail(email)) return
    setBusy(true)
    try { await t.forgotPassword(email.trim()); toast(tr('profile.forgotSent'), 'success'); router.back() }
    catch (x) { setErr((x as Error).message) } finally { setBusy(false) }
  }
  return (
    <SheetScreen title={tr('profile.forgotTitle')} sub={tr('profile.forgotSub')}
      footer={<Button variant="primary" size="lg" busy={busy} title={tr('profile.forgotSend')} onPress={() => void submit()} />}>
      <Field label={tr('profile.email')} value={email} onChangeText={setEmail} error={err ?? (tried && !validEmail(email) ? tr('profile.emailInvalid') : null)}
        keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
        returnKeyType="send" onSubmitEditing={() => void submit()} />
    </SheetScreen>
  )
}

export function CheckMailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  return (
    <SheetScreen title={tr('profile.checkTitle')} sub={tr('profile.checkSub', { email: email ?? '' })}
      footer={<Button variant="primary" size="lg" title={tr('profile.backToSignIn')} onPress={() => router.dismissTo('/signin')} />} />
  )
}

