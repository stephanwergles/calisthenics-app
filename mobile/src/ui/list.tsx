/* Gruppierte Liste wie die iOS-Einstellungen: eine Karte, Zeilen mit Trennlinien, links optional
   ein Symbol (Volt), rechts Wert/Chevron. Für kurze, feste Gruppen (Profil, Daten). */
import { Fragment } from 'react'
import { Pressable, View } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { Icon, type IconName } from './icon'
import { Text } from './text'
import { color, radius } from './theme'

export interface ListRowProps {
  title: string
  subtitle?: string
  trailing?: string
  icon?: IconName
  /** destruktive Zeile (rot) */
  danger?: boolean
  onPress?: () => void
  /** rechts eigenes Element statt Chevron (z. B. Switch) */
  accessory?: React.ReactNode
}

export function ListGroup({ rows }: { rows: ListRowProps[] }) {
  return (
    <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <Fragment key={`${r.title}-${i}`}>
          {i > 0 && <View style={{ height: 0.5, backgroundColor: color.line, marginLeft: r.icon ? 56 : 16 }} />}
          <ListRow {...r} />
        </Fragment>
      ))}
    </View>
  )
}

export function ListRow({ title, subtitle, trailing, icon, danger, onPress, accessory }: ListRowProps) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 52 }}>
      {icon && <View style={{ width: 26, alignItems: 'center' }}><Icon name={icon} size={19} color={danger ? color.danger : color.accent} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ fontSize: 16.5, color: danger ? color.danger : color.text }}>{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {trailing ? <Text variant="muted" numberOfLines={1}>{trailing}</Text> : null}
      {accessory ?? (onPress ? <Icon name="right" size={13} color={color.muted} /> : null)}
    </View>
  )
  if (!onPress) return content
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle, trailing].filter(Boolean).join(', ')}
      onPress={() => { platform().signals.haptic('tap'); onPress() }}
      style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
      {content}
    </Pressable>
  )
}
