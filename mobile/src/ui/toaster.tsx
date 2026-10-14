/* Toast: Glas-Kapsel oben, über allem – auch über Sheets (FullWindowOverlay auf iOS).
   Hört auf toast() aus dem Kern (@lever/core/toast.ts). 2,6 s, Fehler 4 s, Tipp schließt. */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FullWindowOverlay } from 'react-native-screens'
import { onToast, type ToastMsg } from '@lever/core/toast.ts'
import { platform } from '@lever/core/platform.ts'
import { Glass } from './glass'
import { Icon } from './icon'
import { Text } from './text'
import { color } from './theme'

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const insets = useSafeAreaInsets()
  useEffect(() => onToast(m => {
    setMsg(m)
    platform().signals.haptic(m.tone === 'error' ? 'warning' : 'success')
  }), [])
  useEffect(() => {
    if (!msg) return
    const id = setTimeout(() => setMsg(null), msg.tone === 'error' ? 4000 : 2600)
    return () => clearTimeout(id)
  }, [msg])
  const body = (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, alignItems: 'center' }}>
      {msg && (
        <Animated.View key={msg.id} entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(180)}>
          <Pressable onPress={() => setMsg(null)} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Glass style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 16, paddingRight: 20, borderRadius: 24, maxWidth: 360 }}>
              <Icon name={msg.tone === 'error' ? 'warning' : msg.tone === 'success' ? 'checkCircle' : 'info'} size={18} color={msg.tone === 'error' ? color.danger : color.accent} />
              <Text style={{ fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: color.text, flexShrink: 1 }}>{msg.text}</Text>
            </Glass>
          </Pressable>
        </Animated.View>
      )}
    </View>
  )
  if (process.env.EXPO_OS === 'ios') return <FullWindowOverlay>{body}</FullWindowOverlay>
  return body
}
