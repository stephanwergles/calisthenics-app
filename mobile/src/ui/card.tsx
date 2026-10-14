/* Karte (Fläche) und Abschnitts-Überschrift. Karten sind statisch; antippbar wird eine Karte mit
   onPress (dann Pressable mit Druck-Rückmeldung). */
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Text } from './text'
import { color, radius, space } from './theme'

export function Card({ children, style, onPress, active, label }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void
  /** Volt-Rand (aktive/empfohlene Karte) */
  active?: boolean
  label?: string
}) {
  const base: ViewStyle = {
    backgroundColor: color.card, borderWidth: 1, borderColor: active ? color.accentLine : color.line,
    borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg, gap: space.sm,
  }
  if (!onPress) return <View style={[base, style]}>{children}</View>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { platform().signals.haptic('tap'); onPress() }}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }], opacity: pressed ? 0.9 : 1 }, style]}>
      {children}
    </Pressable>
  )
}

/** Abschnitts-Überschrift in Display-Schrift, optional mit Aktion rechts */
export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm, minHeight: 32 }, style]}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {right}
    </View>
  )
}
