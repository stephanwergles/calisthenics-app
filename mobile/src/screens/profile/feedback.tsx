/* Feedback senden – landet in der Datenbank, nur Admins lesen es. Nur angemeldet. (Web: FeedbackPage) */
import { useState } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import { sendFeedback } from '@lever/core/api.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { Button, color, Segmented, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { Field } from './parts'
import { APP_VERSION } from './shared'

type Cat = 'bug' | 'idea' | 'other'

export function FeedbackPage() {
  const { t } = useApp()
  const [category, setCategory] = useState<Cat>('idea')
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | `fail:${string}`>('idle')
  const signedIn = !!t.sync.account
  const send = async () => {
    const message = text.trim()
    if (message.length < 3 || state === 'sending') return
    setState('sending')
    try {
      await sendFeedback({ category, message, appVersion: APP_VERSION, platform: Platform.OS === 'android' ? 'android' : 'ios', screen: 'profile' })
      setState('sent'); setText('')
      toast(tr('common.toast.feedbackSent'), 'success')
    } catch (e) { setState(`fail:${(e as Error).message}`) }
  }
  const failed = state.startsWith('fail:')
  const status = state === 'sent' ? tr('profile.feedback.sent') : failed ? tr('profile.feedback.failed', { msg: state.slice(5) }) : null

  if (!signedIn) return (
    <SheetScreen title={tr('profile.feedback.title')} sub={tr('profile.feedback.signInFirst')}>
      <Button variant="primary" icon="user" title={tr('profile.signInRow')} onPress={() => router.push('/profile/account')} />
    </SheetScreen>
  )
  return (
    <SheetScreen title={tr('profile.feedback.title')} sub={tr('profile.feedback.sub')}
      footer={<Button variant="primary" size="lg" title={tr('common.send')} busy={state === 'sending'}
        disabled={text.trim().length < 3} onPress={() => void send()} />}>
      <Segmented label={tr('profile.feedback.kind')} value={category} onChange={setCategory}
        options={(['bug', 'idea', 'other'] as const).map(id => ({ id, title: tr(`profile.feedback.cat.${id}`) }))} />
      <Field label={tr('profile.feedback.message')} multiline maxLength={4000} value={text}
        placeholder={tr('profile.feedback.placeholder')}
        onChangeText={v => { setText(v); if (state !== 'idle' && state !== 'sending') setState('idle') }} />
      {status && <Text variant="muted" accessibilityLiveRegion="polite" style={{ color: failed ? color.danger : color.accent }}>{status}</Text>}
    </SheetScreen>
  )
}
