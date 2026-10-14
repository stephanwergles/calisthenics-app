/* Pause als eigener Screen über dem Training (Web: RestOverlay): großer Ring, Feinjustierung,
   was als Nächstes kommt. „Los“ beendet die Pause; „Zurück“ schließt nur die Ansicht – der
   Timer läuft weiter und klingelt trotzdem. */
import { useEffect } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { cancelAnimation, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as L from '@lever/core/logic.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, ExerciseStill, font, GUTTER, Icon, radius, Ring, Text } from '@/ui'

export function RestScreen() {
  const { rest, restView, setRestView, slots, focus } = useApp()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const next = L.upNext(slots, focus)
  const close = () => setRestView(null)
  const left = rest.ringing ? 0 : rest.remaining
  // aus dem exakten Rest, nicht aus ganzen Sekunden – der Ring läuft so flüssig statt in Stufen
  const share = rest.total && !rest.ringing ? Math.min(1, rest.remainingMs / (rest.total * 1000)) : 0
  const size = Math.min(width - 2 * GUTTER - 40, height * 0.36, 300)

  // Klingeln: Ring pulsiert (optisches Signal, falls der Ton stumm ist)
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (rest.ringing) pulse.set(withRepeat(withTiming(0.35, { duration: 420 }), -1, true))
    else { cancelAnimation(pulse); pulse.set(1) }
  }, [rest.ringing, pulse])
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }))

  const go = () => { platform().signals.haptic('tap'); rest.stop(); close() }

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, {
        backgroundColor: color.bg, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 10, paddingHorizontal: GUTTER,
        justifyContent: 'space-between', gap: 16,
      }]}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Text variant="eyebrow" accessibilityRole="header" style={{ fontSize: 14, letterSpacing: 2 }}>
          {rest.ringing || !rest.running ? tr('training.rest.over') : tr('training.rest.title')}
        </Text>
        {restView ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(244,244,244,0.08)' }}>
            <Icon name="checkCircle" size={16} color={color.chalk} />
            <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: color.text }}>{restView}</Text>
          </View>
        ) : null}
      </View>

      <Animated.View style={[{ alignItems: 'center' }, pulseStyle]}>
        <Ring size={size} stroke={12} progress={rest.ringing ? 1 : share}>
          <View style={{ alignItems: 'center' }} accessible accessibilityRole="timer"
            accessibilityLabel={rest.ringing ? tr('training.rest.goNow') : tr('training.rest.remaining', { time: L.fmtClock(left) })}>
            <Text style={{ fontFamily: font.displayBlack, fontSize: size * 0.3, lineHeight: size * 0.31, color: rest.ringing ? color.accent : color.text, fontVariant: ['tabular-nums'] }}>
              {rest.ringing ? tr('training.rest.goNow') : L.fmtClock(left)}
            </Text>
            <Text variant="muted">{tr('training.rest.of', { time: L.fmtClock(rest.total) })}</Text>
          </View>
        </Ring>
      </Animated.View>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} title="−15 s" label={tr('training.rest.less')} disabled={!rest.running} onPress={() => rest.shift(-15)} />
          <Button style={{ flex: 1 }} title="+30 s" label={tr('training.rest.more')} disabled={!rest.running} onPress={() => rest.shift(30)} />
          <Button style={{ flex: 1.2 }} variant="outline" icon="skip" title={tr('training.rest.go')} onPress={go} />
        </View>

        {next && (
          <Pressable onPress={() => { platform().signals.haptic('tap'); close() }} accessibilityRole="button"
            accessibilityLabel={`${tr('training.rest.next')}: ${tr('training.rest.nextSet', { set: next.setNo, planned: next.slot.planned })}, ${tr('training.rest.nextSub', { name: next.slot.step.exercise.name, target: next.slot.step.target.label })}`}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.card, borderCurve: 'continuous',
              backgroundColor: pressed ? color.card2 : color.card, borderWidth: 1, borderColor: color.line,
            })}>
            <ExerciseStill exercise={next.slot.step.exercise} style={{ width: 64, height: 64, borderRadius: 14 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="eyebrow" style={{ fontSize: 11 }}>{tr('training.rest.next')}</Text>
              <Text variant="title" style={{ fontSize: 20 }}>{tr('training.rest.nextSet', { set: next.setNo, planned: next.slot.planned })}</Text>
              <Text variant="small" numberOfLines={1}>{tr('training.rest.nextSub', { name: next.slot.step.exercise.name, target: next.slot.step.target.label })}</Text>
            </View>
            <Icon name="right" size={14} color={color.muted} />
          </Pressable>
        )}
        <Button variant="ghost" block title={tr('training.rest.back')} onPress={close} />
      </View>
    </Animated.View>
  )
}
