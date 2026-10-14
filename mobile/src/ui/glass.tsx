/* Glasfläche: echtes Liquid Glass (iOS 26, expo-glass-effect), sonst halbtransparente Fläche. */
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect'
import { color } from './theme'

let glassOk: boolean | null = null
export const hasGlass = () => (glassOk ??= (() => { try { return isGlassEffectAPIAvailable() } catch { return false } })())

export function Glass({ children, style, interactive, tint }: {
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; interactive?: boolean; tint?: string
}) {
  if (hasGlass()) return <GlassView style={style} isInteractive={interactive} tintColor={tint} glassEffectStyle="regular">{children}</GlassView>
  return <View style={[{ backgroundColor: 'rgba(40, 40, 40, 0.92)', borderWidth: 1, borderColor: color.glassLine }, style]}>{children}</View>
}
