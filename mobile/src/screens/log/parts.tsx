/* Kleine Bausteine des Log-Bereichs: Kennzahlen-Kacheln, Satz-Chips, Notiz-Zeile. */
import { View } from 'react-native'
import type { SetLog } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { color, font, Icon, radius, Text } from '@/ui'

export interface Stat { value: string; label: string; extra?: React.ReactNode; accent?: boolean; a11y?: string }

/** Drei Kennzahlen nebeneinander als Kacheln (Einheit im Verlauf) */
export function StatTiles({ items }: { items: Stat[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((s, i) => (
        <View key={i} accessible accessibilityLabel={s.a11y ?? `${s.value} ${s.label}`}
          style={{ flex: 1, gap: 4, paddingVertical: 14, paddingHorizontal: 12, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: color.card, borderWidth: 1, borderColor: color.line }}>
          <Text variant="num" style={{ fontSize: 34, lineHeight: 34, color: s.accent ? color.accent : color.text }}>{s.value}</Text>
          <Text variant="small" style={{ fontSize: 12 }}>{s.label}{s.extra}</Text>
        </View>
      ))}
    </View>
  )
}

/** Sätze einer Übung als Chips: Wert, Einheit, Zusatzgewicht, Punkt bei Notiz */
export function SetChips({ sets, seconds }: { sets: SetLog[]; seconds: boolean }) {
  const unit = seconds ? 's' : ''
  const a11y = tr('history.setsAria', {
    list: sets.map(x => `${x.value}${seconds ? ' s' : ''}${x.weightKg ? ` +${L.fmtNum(x.weightKg)} kg` : ''}${x.note ? ` (${tr('history.withNote')})` : ''}`).join(', '),
  })
  return (
    <View accessible accessibilityLabel={a11y} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
      {sets.map((x, i) => (
        <View key={i} style={{ minWidth: 34, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: color.card2, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }}>
          <Text variant="num" style={{ fontSize: 18, lineHeight: 22 }}>{x.value}</Text>
          {unit ? <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: color.muted, marginLeft: 1 }}>{unit}</Text> : null}
          {x.weightKg ? <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: color.muted, marginLeft: 2 }}>+{L.fmtNum(x.weightKg)}</Text> : null}
          {x.note ? <View style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent }} /> : null}
        </View>
      ))}
    </View>
  )
}

/** Notiz mit Symbol (Einheit, Cardio, Satz) */
export function NoteLine({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const sm = size === 'sm'
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: sm ? 2 : 3 }}><Icon name="note" size={sm ? 12 : 15} color={color.accent} /></View>
      <Text selectable variant={sm ? 'small' : 'body'} style={{ flex: 1, color: color.text }}>{text}</Text>
    </View>
  )
}
