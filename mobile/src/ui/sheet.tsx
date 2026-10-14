/* Gerüst für Sheets und Push-Seiten (Routen mit presentation formSheet/modal): Titel in
   Display-Schrift, Untertitel, scrollender Inhalt, feste Fußzeile (Hauptaktion). Der native
   Header (Zurück als Glas-Button, Wischgeste) kommt vom Stack; der Titel steht im Inhalt. */
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './text'
import { color, GUTTER, space } from './theme'

export function SheetScreen({ title, sub, children, footer, scroll = true, contentStyle, headerSpace = true }: {
  title?: string; sub?: string; children?: React.ReactNode
  /** feste Fußzeile (z. B. Speichern) */
  footer?: React.ReactNode
  scroll?: boolean
  contentStyle?: StyleProp<ViewStyle>
  /** Platz für den transparenten nativen Header (Zurück/Schließen) */
  headerSpace?: boolean
}) {
  const insets = useSafeAreaInsets()
  const head = title ? (
    <View style={{ gap: 4, marginBottom: space.lg }}>
      <Text variant="display" accessibilityRole="header">{title}</Text>
      {sub ? <Text variant="muted">{sub}</Text> : null}
    </View>
  ) : null
  const pad: ViewStyle = { paddingHorizontal: GUTTER, paddingTop: headerSpace ? 20 : 24, paddingBottom: footer ? 16 : insets.bottom + 24, gap: space.md }
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, contentStyle]}>
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{head}{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 4, gap: 10, borderTopWidth: 0.5, borderTopColor: color.line, backgroundColor: color.bg }}>
          {footer}
        </View>
      ) : null}
    </View>
  )
}
