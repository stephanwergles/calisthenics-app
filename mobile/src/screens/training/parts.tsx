/* Bausteine des Trainings-Bereichs (Fokus, Satz-Sheet, Übungsplan, Abschluss): Gerüst für
   Form-Sheets mit Glas-Hintergrund, Satz-Kacheln, Notizfeld, Checklisten-Gruppe, Übungszeile. */
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { color, ExerciseStill, font, GUTTER, hasClip, Icon, radius, space, Text, type IconName } from '@/ui'

const haptic = () => platform().signals.haptic('tap')

/** Inhalt eines Form-Sheets (Detents, Glas): Titel, Untertitel, Inhalt, Aktion am Ende des Inhalts.
    Die Aktion ist bewusst nicht unten angeheftet: in der halbhohen Detent-Stufe begrenzt iOS die
    Scrollfläche nicht, ein fester Fuß lag dann über langem Inhalt (Verletzungs-Sheet). Durchsichtig,
    damit der native Sheet-Hintergrund (Liquid Glass) bleibt. */
export function FormSheet({ title, sub, children, footer }: {
  title: string; sub?: string; children?: React.ReactNode; footer?: React.ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 28, paddingBottom: Math.max(insets.bottom, 12) + 8, gap: space.md }}>
      <View style={{ gap: 4, marginBottom: space.xs }}>
        <Text variant="display" accessibilityRole="header">{title}</Text>
        {sub ? <Text variant="muted">{sub}</Text> : null}
      </View>
      {children}
      {footer ? <View style={{ gap: 10, marginTop: space.sm }}>{footer}</View> : null}
    </ScrollView>
  )
}

/** Mehrzeiliges Notizfeld (Satz, Einheit) */
export function NoteInput({ label, style, ...rest }: TextInputProps & { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="note" size={14} color={color.muted} />
        <Text variant="small" style={{ fontFamily: font.bodySemi }}>{label}</Text>
      </View>
      <TextInput
        // Zeilenschalter = Fertig: mehrzeilig nur zum Umbrechen, sonst gäbe es keinen Weg, die Tastatur zu schließen
        multiline returnKeyType="done" submitBehavior="blurAndSubmit"
        maxLength={L.NOTE_MAX} keyboardAppearance="dark" placeholderTextColor={color.muted}
        selectionColor={color.accent} accessibilityLabel={label}
        style={{
          minHeight: 64, maxHeight: 140, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
          backgroundColor: color.card2, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line,
          color: color.text, fontFamily: font.body, fontSize: 16, lineHeight: 21, textAlignVertical: 'top',
        }}
        {...rest} />
    </View>
  )
}

/** Satz-Kacheln: erfasste Werte (Kreide), aktueller Satz (Volt-Rand), offene Sätze; dazu Satzzahl −/+.
    Tipp auf eine Kachel öffnet das Satz-Sheet. */
export function SetTiles({ slot, setNo }: { slot: L.SlotView; setNo: number | null }) {
  const { t } = useApp()
  const ex = slot.step.exercise
  const bars = Math.max(slot.planned, ...slot.sets.map(x => x.set))
  const canRemove = slot.planned > Math.max(1, ...slot.sets.map(x => x.set))
  const open = (n: number) => router.push({ pathname: '/set', params: { pid: slot.pid, setNo: String(n) } })
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={tr('training.focus.sets')}>
      {Array.from({ length: bars }, (_, i) => {
        const n = i + 1
        const v = slot.sets.find(x => x.set === n)
        const current = !v && n === setNo
        return (
          <Pressable key={n} onPress={() => { haptic(); open(n) }} accessibilityRole="button"
            accessibilityLabel={v ? tr('training.focus.setEdit', { set: n, value: L.fmtSet(v, ex) }) : tr('training.focus.setLog', { set: n })}
            style={({ pressed }) => ({
              flex: 1, maxWidth: 64, height: 44, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center',
              backgroundColor: v ? color.chalk : current ? color.accentDim : 'transparent',
              borderWidth: v ? 0 : current ? 2 : 1, borderColor: current ? color.accent : color.line,
              boxShadow: v ? '0 0 0 3px rgba(244, 244, 244, 0.12)' : undefined,
              opacity: pressed ? 0.75 : 1,
            })}>
            {/* mit Zusatzgewicht: Wiederholungen und Gewicht untereinander mit Luft, nicht überlagert */}
            <Text style={{ fontFamily: font.display, fontSize: v ? (v.weightKg ? 18 : 20) : 15, lineHeight: v?.weightKg ? 19 : undefined, color: v ? color.onAccent : current ? color.accent : color.muted, fontVariant: ['tabular-nums'] }}>
              {v ? v.value : n}
            </Text>
            {v?.weightKg ? <Text style={{ fontFamily: font.bodyBold, fontSize: 10, lineHeight: 12, marginTop: 1, color: color.onAccent, opacity: 0.7 }}>+{L.fmtNum(v.weightKg)} kg</Text> : null}
            {v?.note ? <View style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: color.onAccent }} /> : null}
          </Pressable>
        )
      })}
      {canRemove && <TileButton icon="minus" label={tr('training.focus.setLess')} onPress={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned - 1))} />}
      <TileButton icon="plus" label={tr('training.focus.setMore')} onPress={() => t.updateToday(x => L.withPlan(x, slot.pid, slot.planned + 1))} />
    </View>
  )
}

function TileButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44, height: 44, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.14)' : color.ghost, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
      })}>
      <Icon name={icon} size={15} color={color.muted} />
    </Pressable>
  )
}

/** Aufklappbare Checkliste (Warm-up, Cool-down) */
export function ChecklistGroup({ title, items, onToggle }: {
  title: string
  items: { id: string; title: string; sub?: string; on: boolean }[]
  onToggle: (id: string, on: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const n = items.filter(x => x.on).length
  const complete = n === items.length && items.length > 0
  return (
    <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: complete ? color.accentLine : color.line, overflow: 'hidden' }}>
      <Pressable onPress={() => { haptic(); setOpen(o => !o) }} accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${n}/${items.length}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
        <Text variant="title" style={{ flex: 1, fontSize: 19 }}>{title}</Text>
        <Text style={{ fontFamily: font.display, fontSize: 17, color: complete ? color.accent : color.muted, fontVariant: ['tabular-nums'] }}>{n}/{items.length}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="down" size={14} color={color.muted} /></View>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
          {items.map(x => (
            <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: x.on }}
              accessibilityLabel={[x.title, x.sub].filter(Boolean).join(', ')}
              onPress={() => { haptic(); onToggle(x.id, !x.on) }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
              <View style={{
                width: 24, height: 24, borderRadius: 7, borderCurve: 'continuous', borderWidth: x.on ? 0 : 1.5, borderColor: color.muted,
                backgroundColor: x.on ? color.chalk : 'transparent', alignItems: 'center', justifyContent: 'center',
              }}>
                {x.on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="label" style={{ color: x.on ? color.muted : color.text }}>{x.title}</Text>
                {x.sub ? <Text variant="small">{x.sub}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

/** Zeile mit Übung: Standbild (oder Zustandsmarke), Name, Zusatzzeilen, rechts Wert */
export function ExerciseRow({ exercise, eyebrow, title, lines, trailing, mark, highlight, dim, onPress, label }: {
  exercise: L.SlotView['step']['exercise']
  eyebrow?: string
  title: string
  lines?: { text: string; accent?: boolean }[]
  trailing?: string
  mark?: 'done' | 'skipped' | 'paused' | 'add' | null
  highlight?: boolean
  dim?: boolean
  onPress: () => void
  label?: string
}) {
  const markIcon: IconName | null = mark === 'done' ? 'check' : mark === 'skipped' ? 'minus' : mark === 'paused' ? 'pause' : mark === 'add' ? 'plus' : null
  const clip = hasClip(exercise.id)
  return (
    <Pressable onPress={() => { haptic(); onPress() }} accessibilityRole="button"
      accessibilityLabel={label ?? [eyebrow, title, ...(lines ?? []).map(l => l.text), trailing].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, paddingHorizontal: 12,
        borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1,
        borderColor: highlight ? color.accentLine : 'transparent',
        backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : highlight ? color.accentDim : color.card,
      })}>
      <View style={{ width: 48, height: 48 }}>
        {clip
          ? <ExerciseStill exercise={exercise} style={{ width: 48, height: 48, borderRadius: 12, opacity: dim ? 0.45 : 1 }} />
          : <View style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' }}>
              {markIcon && <Icon name={markIcon} size={16} color={mark === 'done' ? color.chalk : color.muted} />}
            </View>}
        {clip && markIcon && (
          <View style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: mark === 'done' ? color.chalk : color.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.bg }}>
            <Icon name={markIcon} size={10} color={mark === 'done' ? color.onAccent : color.muted} weight="bold" />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? <Text variant="eyebrow" style={{ fontSize: 11, lineHeight: 14 }}>{eyebrow}</Text> : null}
        <Text variant="label" numberOfLines={2} style={{ color: dim ? color.muted : color.text }}>{title}</Text>
        {lines?.map(l => <Text key={l.text} variant="small" style={l.accent ? { color: color.accent, fontFamily: font.bodySemi } : undefined}>{l.text}</Text>)}
      </View>
      {trailing ? <Text variant="small" numberOfLines={1} style={{ maxWidth: 120, textAlign: 'right', fontFamily: font.bodySemi, color: mark === 'done' ? color.text : color.muted }}>{trailing}</Text> : null}
    </Pressable>
  )
}

/** dünner Fortschrittsbalken (Sätze erledigt) */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const share = total ? Math.min(1, done / total) : 0
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: done }}
      style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <View style={{ width: `${share * 100}%`, height: '100%', borderRadius: 3, backgroundColor: color.accent }} />
    </View>
  )
}
