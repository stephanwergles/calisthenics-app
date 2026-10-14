/* Zeilen und Karten des Skills-Tabs. Skill-Zeilen und Ziel-Karten sind Links mit nativer
   Vorschau (lange drücken) und Kontextmenü (Ziel setzen/entfernen); Tippen schiebt die Skill-Seite. */
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { Link, router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import type { Exercise } from '@lever/domain/model.ts'
import { color, ExerciseStill, font, Icon, Ring, sf, Text } from '@/ui'
import { Bar } from './shared'

const pct = (share: number) => Math.round(share * 100)

/** Pressable, das die Props von Link (asChild) durchreicht */
function Tap({ style, ...rest }: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" {...rest}
      style={[{ backgroundColor: 'transparent' }, style]} />
  )
}

/** Kontextmenü eines Skills: Ziel an/aus */
function GoalMenu({ goal, full, onToggle }: { goal: boolean; full: boolean; onToggle: (on: boolean) => void }) {
  return (
    <Link.Menu>
      <Link.MenuAction icon={sf(goal ? 'minus' : 'target') as never} disabled={!goal && full} onPress={() => onToggle(!goal)}>
        {goal ? tr('skills.removeGoal') : full ? tr('skills.goalsFull') : tr('skills.setGoal')}
      </Link.MenuAction>
    </Link.Menu>
  )
}

const tapHaptic = () => platform().signals.haptic('tap')

/** Kompakte Zeile in „Alle Skills“: Name (+ Ziel), Stand bzw. was fehlt, rechts Prozent + Balken */
export function SkillRow({ card, full, onToggleGoal }: { card: L.SkillCard; full: boolean; onToggleGoal: (on: boolean) => void }) {
  // noch gesperrt: Voraussetzung fehlt und nicht begonnen – Schloss + „Erst noch: …“ statt grauem Titel
  const locked = !card.reached && !card.started && card.missing.length > 0
  const sub = card.reached ? tr('skills.reachedSub')
    : locked ? tr('skills.reason.missing', { list: card.missing.join(', ') })
    : `${card.stage} · ${card.current}`
  const label = [card.skill.name, card.goal ? tr('skills.goalBadge') : '', card.reached ? tr('skills.reachedBadge') : '', sub, tr('skills.percentLabel', { n: pct(card.share) })].filter(Boolean).join(', ')
  return (
    <Link href={{ pathname: '/skill/[id]', params: { id: card.skill.id } }} asChild onPress={tapHaptic}>
      <Link.Trigger>
        <Tap accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingLeft: 16, paddingRight: 14, minHeight: 64 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text variant="title" style={{ fontSize: 20, lineHeight: 22 }}>{card.skill.name}</Text>
              {card.goal && <Text variant="eyebrow" style={{ fontSize: 11, letterSpacing: 1.2 }}>{tr('skills.goalBadge')}</Text>}
              {card.reached && <Text variant="eyebrow" style={{ fontSize: 11, letterSpacing: 1.2, color: color.text }}>{tr('skills.reachedBadge')}</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {locked && <Icon name="lock" size={11} color={color.muted} />}
              <Text variant="small" numberOfLines={2} style={{ flexShrink: 1 }}>{sub}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6, width: 58 }}>
            {card.reached
              ? <Icon name="checkCircle" size={22} color={color.accent} />
              : <Text style={{ fontFamily: font.display, fontSize: 18, lineHeight: 19, color: card.share > 0 ? color.text : color.muted, fontVariant: ['tabular-nums'] }}>{tr('skills.percent', { n: pct(card.share) })}</Text>}
            <Bar share={card.share} width={58} />
          </View>
          <Icon name="right" size={13} color={color.muted} />
        </Tap>
      </Link.Trigger>
      <Link.Preview />
      <GoalMenu goal={card.goal} full={full} onToggle={onToggleGoal} />
    </Link>
  )
}

/** Ziel als Karte: Ring mit Prozent, Name, aktuelle Stufe */
export function GoalCard({ id, name, share, stage, current, onRemove }: {
  id: string; name: string; share: number; stage: string; current: string; onRemove: () => void
}) {
  // erreichtes Ziel bleibt (weiter verfeinern), ist aber als erreicht erkennbar
  const reached = share >= 1
  return (
    <Link href={{ pathname: '/skill/[id]', params: { id } }} asChild onPress={tapHaptic}>
      <Link.Trigger>
        <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${tr('skills.percentLabel', { n: pct(share) })}, ${stage} · ${current}`}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderCurve: 'continuous',
            backgroundColor: color.card, borderWidth: 1, borderColor: color.accentLine,
          }}>
          <Ring size={58} stroke={5} progress={share}>
            {reached
              ? <Icon name="check" size={22} color={color.accent} weight="bold" />
              : <Text style={{ fontFamily: font.display, fontSize: 15, color: color.text }}>{tr('skills.percent', { n: pct(share) })}</Text>}
          </Ring>
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="title" style={{ fontSize: 21 }}>{name}</Text>
            <Text variant="small" numberOfLines={2}>{reached ? tr('skills.reachedSub') : `${stage} · ${current}`}</Text>
          </View>
          <Icon name="right" size={13} color={color.muted} />
        </Pressable>
      </Link.Trigger>
      <Link.Preview />
      <GoalMenu goal full onToggle={onRemove} />
    </Link>
  )
}

/** Leiter öffnen; `step` klappt diese Stufe gleich auf (z. B. die geforderte Stufe einer Voraussetzung) */
export const openLadder = (pid: string, step?: string) => { tapHaptic(); router.push({ pathname: '/progression/[pid]', params: step ? { pid, step } : { pid } }) }

/** Zeile einer Progression (Grundlagen, Unterstützung): öffnet die Leiter als Modal; optional mit Standbild */
export function ProgressionRow({ pid, name, sub, exercise }: { pid: string; name: string; sub: string; exercise?: Exercise }) {
  return (
    <Tap accessibilityLabel={`${name}, ${sub}`} onPress={() => openLadder(pid)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: exercise ? 10 : 13, paddingLeft: exercise ? 10 : 16, paddingRight: 14, minHeight: 58 }}>
      {exercise && <ExerciseStill exercise={exercise} size={22} style={{ width: 56, height: 56, borderRadius: 12, borderCurve: 'continuous' }} />}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="label" style={{ fontSize: 17 }}>{name}</Text>
        <Text variant="small" numberOfLines={2}>{sub}</Text>
      </View>
      <Icon name="right" size={13} color={color.muted} />
    </Tap>
  )
}
