/* Button-System wie im Web: Kapseln, Icon-Buttons rund. Varianten
   primary (genau eine Hauptaktion: Volt, Display-Schrift) · secondary (Glas) · outline (Volt-Rand)
   · ghost (Nebenaktion) · danger (destruktiv). Mindestens 44 pt hoch. Leitregel: Fläche oder Rand
   = anfassbar. */
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Icon, type IconName } from './icon'
import { Text } from './text'
import { color, font, TAP } from './theme'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const SURFACE: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: color.accent, boxShadow: '0 6px 18px rgba(212, 255, 58, 0.18)' },
  secondary: { backgroundColor: color.glass, borderWidth: 1, borderColor: color.glassLine },
  outline: { backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accent },
  ghost: { backgroundColor: color.ghost, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)' },
  danger: { backgroundColor: color.dangerDim, borderWidth: 1, borderColor: color.dangerLine },
}
const FG: Record<ButtonVariant, string> = {
  primary: color.onAccent, secondary: color.text, outline: color.accent, ghost: color.muted, danger: color.danger,
}
const HEIGHT: Record<Size, number> = { sm: 36, md: TAP, lg: 56 }

export interface ButtonProps {
  title?: string
  icon?: IconName
  variant?: ButtonVariant
  size?: Size
  onPress?: () => void
  disabled?: boolean
  /** Aktivitätsanzeige statt Icon, gesperrt */
  busy?: boolean
  /** volle Breite */
  block?: boolean
  /** nur Icon (rund) – dann ist label Pflicht für VoiceOver */
  label?: string
  style?: StyleProp<ViewStyle>
  /** Haptik beim Tippen (Standard: an) */
  haptic?: boolean
}

export function Button({ title, icon, variant = 'secondary', size = 'md', onPress, disabled, busy, block, label, style, haptic = true }: ButtonProps) {
  const h = HEIGHT[size]
  const iconOnly = !title
  const fg = FG[variant]
  const display = variant === 'primary'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      hitSlop={size === 'sm' ? 4 : 0}
      onPress={() => { if (haptic) platform().signals.haptic('tap'); onPress?.() }}
      style={({ pressed }) => [
        {
          height: h, minWidth: h, borderRadius: 999, borderCurve: 'continuous',
          paddingHorizontal: iconOnly ? 0 : size === 'sm' ? 14 : 20,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        SURFACE[variant],
        pressed && variant !== 'primary' ? { backgroundColor: 'rgba(255, 255, 255, 0.14)' } : null,
        block ? { alignSelf: 'stretch' } : null,
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : size === 'lg' ? 20 : 18} color={fg} /> : null}
      {title ? (
        <Text
          numberOfLines={1}
          style={display
            ? { fontFamily: font.display, fontSize: size === 'lg' ? 20 : 17, lineHeight: size === 'lg' ? 22 : 19, color: fg, textTransform: 'uppercase', letterSpacing: 0.4 }
            : { fontFamily: font.bodySemi, fontSize: size === 'sm' ? 13 : 15, lineHeight: 19, color: fg }}>
          {title}
        </Text>
      ) : null}
    </Pressable>
  )
}

/** Zwei oder mehr Buttons nebeneinander, gleich breit */
export function ButtonRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: 10 }, style]}>{children}</View>
}
