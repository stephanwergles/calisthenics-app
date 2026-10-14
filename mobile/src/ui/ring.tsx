/* Fortschrittsring (Skills, Pause, Halte-Timer). progress 0–1, Inhalt in der Mitte. */
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { color } from './theme'

export function Ring({ size, stroke = 6, progress, tint = color.accent, track = 'rgba(255,255,255,0.08)', children }: {
  size: number; stroke?: number; progress: number; tint?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(1, progress))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {p > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} />}
      </Svg>
      {children}
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Countdown-Ring, der flüssig bis `end` (ms-Zeitstempel) leerläuft – die Animation läuft im
    UI-Thread durchgehend, statt bei jedem Timer-Tick einen neuen Stand zu zeichnen. Ohne `end` voll. */
export function CountdownRing({ size, stroke = 6, end, totalMs, tint = color.accent, track = 'rgba(255,255,255,0.08)', children }: {
  size: number; stroke?: number; end: number | null; totalMs: number; tint?: string; track?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const share = useSharedValue(1)
  useEffect(() => {
    if (!end || totalMs <= 0) { cancelAnimation(share); share.set(1); return }
    const left = Math.max(0, end - Date.now())
    share.set(Math.min(1, left / totalMs))
    share.set(withTiming(0, { duration: left, easing: Easing.linear }))
    return () => cancelAnimation(share)
  }, [end, totalMs, share])
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - share.get()) }))
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={tint} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      {children}
    </View>
  )
}
