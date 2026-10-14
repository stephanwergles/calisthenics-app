/* Fortschrittsring (Skills, Pause, Halte-Timer). progress 0–1, Inhalt in der Mitte. */
import { View } from 'react-native'
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
