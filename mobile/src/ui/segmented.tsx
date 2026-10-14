/* Segment-Schalter (Pille) wie im Web (.seg.pill): Glasfläche, gewähltes Segment in Volt-Tönung. */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Text } from './text'
import { color, font } from './theme'

export function Segmented<T extends string>({ options, value, onChange, style, label }: {
  options: { id: T; title: string }[]; value: T; onChange: (id: T) => void; style?: StyleProp<ViewStyle>; label?: string
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}
      style={[{ flexDirection: 'row', backgroundColor: color.glass, borderWidth: 1, borderColor: color.glassLine, borderRadius: 999, padding: 3, gap: 2 }, style]}>
      {options.map(o => {
        const on = o.id === value
        return (
          <Pressable key={o.id} accessibilityRole="tab" accessibilityState={{ selected: on }}
            onPress={() => { if (!on) { platform().signals.haptic('tap'); onChange(o.id) } }}
            style={{ flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
              backgroundColor: on ? 'rgba(212, 255, 58, 0.14)' : 'transparent' }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? font.bodyBold : font.bodySemi, fontSize: 14, color: on ? color.accent : color.muted }}>{o.title}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}
