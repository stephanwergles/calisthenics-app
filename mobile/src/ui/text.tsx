/* Text-Varianten. Display = Barlow Condensed in Großbuchstaben (Überschriften, Zahlen),
   sonst Barlow. Wichtige Daten sind auswählbar (selectable). */
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native'
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

const DISPLAY = new Set<string>([font.display, font.displayBlack, font.displaySemi].filter(Boolean) as string[])
/** Enge Zeilenhöhe (kleiner als die Schrift, typisch für Barlow Condensed in Großbuchstaben)
    schneidet auf iOS alles oberhalb der ersten Zeile ab – Ü-, Ä-, Ö-Punkte. Ausgleich: oben Platz
    schaffen (padding) und gleich viel wieder abziehen (margin), das Layout bleibt gleich. */
function roomForAccents(s: TextStyle): TextStyle | null {
  const size = s.fontSize, lh = s.lineHeight
  if (!size || !lh || !s.fontFamily || !DISPLAY.has(s.fontFamily) || lh >= size * 1.2) return null
  const extra = Math.ceil(size * 1.2 - lh)
  const mt = (s.marginTop ?? s.marginVertical ?? s.margin ?? 0) as number
  const pt = (s.paddingTop ?? s.paddingVertical ?? s.padding ?? 0) as number
  return typeof mt === 'number' && typeof pt === 'number' ? { paddingTop: pt + extra, marginTop: mt - extra } : null
}

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const flat = StyleSheet.flatten([styles[variant], style]) as TextStyle
  const fix = roomForAccents(flat)
  return <RNText {...rest} style={fix ? [flat, fix] : flat} />
}
export const textStyle = styles
