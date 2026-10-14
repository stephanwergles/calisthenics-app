/* Text-Varianten. Display = Barlow Condensed in Großbuchstaben (Überschriften, Zahlen),
   sonst Barlow. Wichtige Daten sind auswählbar (selectable). */
import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { color, font } from './theme'

type Variant = 'body' | 'muted' | 'small' | 'label' | 'title' | 'display' | 'hero' | 'num' | 'eyebrow'

const styles: Record<Variant, TextStyle> = {
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 22, color: color.text },
  muted: { fontFamily: font.body, fontSize: 15, lineHeight: 21, color: color.muted },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: color.muted },
  label: { fontFamily: font.bodySemi, fontSize: 16, lineHeight: 21, color: color.text },
  title: { fontFamily: font.display, fontSize: 22, lineHeight: 23, color: color.text, textTransform: 'uppercase', letterSpacing: 0.2 },
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 29, color: color.text, textTransform: 'uppercase', letterSpacing: 0.3 },
  hero: { fontFamily: font.displayBlack, fontSize: 52, lineHeight: 49, color: color.text, textTransform: 'uppercase' },
  num: { fontFamily: font.display, fontSize: 28, lineHeight: 30, color: color.text, fontVariant: ['tabular-nums'] },
  eyebrow: { fontFamily: font.bodyBold, fontSize: 12, lineHeight: 16, color: color.accent, textTransform: 'uppercase', letterSpacing: 1.6 },
}

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[styles[variant], style]} />
}
export const textStyle = styles
