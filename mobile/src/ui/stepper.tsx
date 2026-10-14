/* Stepper: großer Wert in der Mitte, runde −/+ Buttons. Für Minuten, Testwerte, Sätze. */
import { View } from 'react-native'
import { Button } from './button'
import { Text } from './text'
import { color, radius } from './theme'

export function Stepper({ label, value, onMinus, onPlus, minusLabel, plusLabel }: {
  label: string; value: string; onMinus: () => void; onPlus: () => void; minusLabel?: string; plusLabel?: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line }}>
      <Button icon="minus" size="lg" label={minusLabel ?? `${label} −`} onPress={onMinus} />
      <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${label}: ${value}`}>
        <Text variant="num" style={{ fontSize: 38, lineHeight: 40 }}>{value}</Text>
        <Text variant="small" style={{ fontFamily: 'Barlow_700Bold', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 }}>{label}</Text>
      </View>
      <Button icon="plus" size="lg" label={plusLabel ?? `${label} +`} onPress={onPlus} />
    </View>
  )
}
