/* Auswahlzeilen mit Kästchen. select = Auswahl (an = hell, aus = gedimmt); sonst Checkliste
   (an = erledigt, gedimmt). radio = genau eine Option (Antippen der gewählten wählt nicht ab). */
import { Pressable, View } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Icon } from './icon'
import { Text } from './text'
import { color } from './theme'

export interface Choice { id: string; title: string; sub?: string; on: boolean }

export function Choices({ items, onToggle, mode = 'select' }: {
  items: Choice[]; onToggle: (id: string, on: boolean) => void; mode?: 'select' | 'radio' | 'checklist'
}) {
  return (
    <View style={{ gap: 2 }}>
      {items.map(x => {
        const dim = mode === 'checklist' ? x.on : !x.on
        return (
          <Pressable key={x.id} accessibilityRole={mode === 'radio' ? 'radio' : 'checkbox'} accessibilityState={{ checked: x.on }}
            accessibilityLabel={[x.title, x.sub].filter(Boolean).join(', ')}
            onPress={() => {
              platform().signals.haptic('tap')
              if (mode === 'radio') { if (!x.on) onToggle(x.id, true) } else onToggle(x.id, !x.on)
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
            <View style={{
              width: 24, height: 24, borderRadius: mode === 'radio' ? 12 : 7, borderCurve: 'continuous',
              borderWidth: x.on ? 0 : 1.5, borderColor: color.muted, backgroundColor: x.on ? color.accent : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {x.on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label" style={{ color: dim ? color.muted : color.text }}>{x.title}</Text>
              {x.sub ? <Text variant="small">{x.sub}</Text> : null}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Mehrfachauswahl als Chips im Umbruch – kompakt für kurze Begriffe (Gelenke, Geräte), passt auch in
    ein halbhohes Sheet. An = Volt mit Haken, aus = helle Fläche. */
export function ChipChoices({ items, onToggle }: { items: Choice[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(x => (
        <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: x.on }} accessibilityLabel={x.title}
          onPress={() => { platform().signals.haptic('tap'); onToggle(x.id, !x.on) }}
          style={({ pressed }) => ({
            // Fläche statt Rand: auf dem Glas-Hintergrund der Sheets wirkt ein dünner Rahmen unruhig
            flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderCurve: 'continuous',
            backgroundColor: x.on ? color.accent : 'rgba(255,255,255,0.10)',
            opacity: pressed ? 0.75 : 1,
          })}>
          {x.on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
          <Text variant="label" style={{ color: x.on ? color.onAccent : color.text }}>{x.title}</Text>
        </Pressable>
      ))}
    </View>
  )
}
