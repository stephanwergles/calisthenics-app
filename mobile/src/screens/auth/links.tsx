/* Konto-Links aus den Mails, in der App geöffnet (Universal Links):
   – Bestätigen: Adresse bestätigen, danach zur Anmeldung (E-Mail vorbelegt geht nicht: der Link trägt sie nicht)
   – Neues Passwort: festlegen, Payload meldet dabei an – danach direkt in die App */
import { useEffect, useRef, useState } from 'react'
import { type TextInputInstance } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { Button, SheetScreen } from '@/ui'
import { useApp } from '@/state/app'
import { Field } from '@/screens/profile/parts'
import { CloseButton } from '@/navigation'

const MIN_PASSWORD = 8
/** zurück an den Anfang: angemeldet nach Heute, sonst zur Anmeldung */
const home = (signedIn: boolean) => router.replace(signedIn ? '/' : '/signin')

export function VerifyScreen() {
  const { t } = useApp()
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [state, setState] = useState<'busy' | 'ok' | 'error'>(token ? 'busy' : 'error')
  const [msg, setMsg] = useState('')
  const sent = useRef(false)
  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    t.verifyEmail(token).then(() => setState('ok')).catch((e: Error) => { setMsg(e.message); setState('error') })
  }, [token, t])
  const signedIn = !!t.sync.account
  const close = <CloseButton onPress={() => home(signedIn)} />
  if (state === 'busy') return <SheetScreen title={tr('profile.linkBusy')} />
  return <>{close}{state === 'ok'
    ? <SheetScreen title={tr('profile.verifiedTitle')} sub={tr('profile.verifiedSub')}
        footer={<Button variant="primary" size="lg" title={signedIn ? tr('profile.toApp') : tr('profile.signIn')} onPress={() => home(signedIn)} />} />
    : <SheetScreen title={tr('profile.linkInvalidTitle')} sub={msg || tr('profile.linkInvalidSub')}
        footer={<Button variant="primary" size="lg" title={signedIn ? tr('profile.toApp') : tr('profile.backToSignIn')} onPress={() => home(signedIn)} />} />}</>
}

export function ResetScreen() {
  const { t } = useApp()
  const { token = '' } = useLocalSearchParams<{ token?: string }>()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const repeatRef = useRef<TextInputInstance>(null)
  const pwErr = tried && password.length < MIN_PASSWORD ? tr('profile.passwordShort') : null
  const repeatErr = tried && !pwErr && repeat !== password ? tr('profile.passwordMismatch') : null
  const submit = async () => {
    setTried(true); setErr(null)
    if (password.length < MIN_PASSWORD || repeat !== password) return
    setBusy(true)
    try {
      await t.resetPassword(token, password)
      toast(tr('profile.passwordSaved'), 'success')
      router.replace('/')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <>
    <CloseButton onPress={() => home(!!t.sync.account)} />
    <SheetScreen title={tr('profile.resetTitle')} sub={tr('profile.resetSub')}
      footer={<Button variant="primary" size="lg" busy={busy} title={tr('profile.resetSave')} onPress={() => void submit()} />}>
      <Field label={tr('profile.passwordNewLabel')} value={password} onChangeText={setPassword} hint={tr('profile.passwordHint')} error={pwErr ?? err}
        secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false}
        returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => repeatRef.current?.focus()} />
      <Field ref={repeatRef} label={tr('profile.passwordRepeat')} value={repeat} onChangeText={setRepeat} error={repeatErr}
        secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" autoCorrect={false}
        returnKeyType="go" onSubmitEditing={() => void submit()} />
    </SheetScreen>
    </>
  )
}
