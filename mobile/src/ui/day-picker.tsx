/* Wochentage als Reihe von Tagesknöpfen (wie der Wochenstreifen auf Heute) statt einer langen
   Checkbox-Liste: gewählt = Volt mit Haken, belegt (z. B. von einem anderen Workout) = Rand + Punkt,
   frei = gestrichelt. Mehrfachauswahl, jeder Knopf 44 pt. */
import { Pressable, View } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Icon } from './icon'
import { Text } from './text'
import { color, font } from './theme'

export interface DayItem {
  id: string
  /** „Mo“ */
  short: string
  /** „Montag“ – für VoiceOver */
  long: string
  on: boolean
  /** von etwas anderem belegt (nur Anzeige) */
  taken?: boolean
  /** Zusatz für VoiceOver, z. B. „statt Tag C“ */
  hint?: string
}

export function DayPicker({ items, onToggle }: { items: DayItem[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {items.map(d => (
        <Pressable key={d.id} accessibilityRole="checkbox" accessibilityState={{ checked: d.on }}
          accessibilityLabel={`${d.long}${!d.on && d.hint ? `, ${d.hint}` : ''}`}
          onPress={() => { platform().signals.haptic('tap'); onToggle(d.id, !d.on) }} hitSlop={4} style={{ alignItems: 'center', gap: 6 }}>
          <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', color: d.on ? color.text : color.muted }}>{d.short}</Text>
          <View style={{
            width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
            backgroundColor: d.on ? color.accent : 'transparent',
            borderWidth: d.on ? 0 : 1.5, borderStyle: d.taken ? 'solid' : 'dashed', borderColor: d.taken ? color.muted : color.line,
          }}>
            {d.on ? <Icon name="check" size={18} color={color.onAccent} weight="bold" />
              : d.taken ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.muted }} /> : null}
          </View>
        </Pressable>
      ))}
    </View>
  )
}
