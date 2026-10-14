/* Bausteine für den Plan-Bereich (Plan-Tab, Vorlagen, Meine Workouts): Zeilen mit Vorschaubild,
   Header-Toolbar im Modal-Stack (Menü + Schließen), Namensfeld, Modal-Navigation. */
import { Fragment, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Stack, useNavigation } from 'expo-router'
import type { Exercise, Weekday } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { Button, color, ExerciseStill, font, Icon, radius, sf, Text, type IconName } from '@/ui'

/** Wochentag ausgeschrieben (übersetzt) */
export const DAY_NAME: Record<Weekday, string> = L.WEEKDAY_LONG

/** Schließt das ganze Modal (Vorlagen, Workouts), egal wie tief im Stack */
export function useCloseModal() {
  const nav = useNavigation()
  return () => {
    const parent = nav.getParent()
    if (parent?.canGoBack()) parent.goBack()
    else nav.goBack()
  }
}

/** erste Seite im Modal-Stack (dann kein Zurück, sondern Schließen) */
export function useIsFirst() {
  const nav = useNavigation()
  return (nav.getState()?.index ?? 0) === 0
}

export interface MenuItem { title: string; icon: IconName; onPress: () => void; destructive?: boolean }

/** Header rechts im Modal-Stack: optional Menü (…), Schließen nur auf der ersten Seite */
export function ModalToolbar({ menu, menuLabel, close }: { menu?: MenuItem[]; menuLabel?: string; close?: boolean }) {
  const closeModal = useCloseModal()
  if (!menu?.length && !close) return null
  return (
    <Stack.Toolbar placement="right">
      {menu?.length ? (
        <Stack.Toolbar.Menu icon={sf('more') as never} accessibilityLabel={menuLabel}>
          {menu.map(m => (
            <Stack.Toolbar.MenuAction key={m.title} icon={sf(m.icon) as never} destructive={m.destructive} onPress={m.onPress}>
              {m.title}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      ) : null}
      {close ? <Stack.Toolbar.Button icon={sf('close') as never} accessibilityLabel={tr('common.close')} onPress={closeModal} /> : null}
    </Stack.Toolbar>
  )
}

export interface RowProps {
  title: string
  subtitle?: string
  trailing?: string
  /** Vorschaubild der Übung (Standbild/Skizze) */
  exercise?: Exercise
  /** Symbol links (Volt) statt Bild */
  icon?: IconName
  /** Symbol in einer Kachel so groß wie ein Übungsbild – in Listen, die Bilder und Symbole mischen */
  iconTile?: boolean
  /** markiert (z. B. heute) */
  tag?: string
  /** gedimmter Titel (Ruhetag) */
  off?: boolean
  onPress?: () => void
  label?: string
}

/** Gruppierte Zeilen in einer Karte; Zeilen mit onPress sind antippbar (Chevron) */
export function Rows({ rows }: { rows: (RowProps & { key: string })[] }) {
  return (
    <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
      {rows.map(({ key, ...r }, i) => (
        <Fragment key={key}>
          {i > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: r.exercise || r.iconTile ? 82 : r.icon ? 56 : 16 }} />}
          <Row {...r} />
        </Fragment>
      ))}
    </View>
  )
}

export function Row({ title, subtitle, trailing, exercise, icon, iconTile, tag, off, onPress, label }: RowProps) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: exercise || iconTile ? 10 : 12, paddingLeft: exercise || iconTile ? 12 : 16, paddingRight: 14, minHeight: 56 }}>
      {exercise ? <ExerciseStill exercise={exercise} size={22} style={{ width: 56, height: 56, borderRadius: radius.lg, borderCurve: 'continuous' }} /> : null}
      {icon && iconTile && !exercise ? (
        <View style={{ width: 56, height: 56, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={color.accent} />
        </View>
      ) : icon && !exercise ? <View style={{ width: 26, alignItems: 'center' }}><Icon name={icon} size={19} color={color.accent} /></View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" style={{ fontSize: 16.5, color: off ? color.muted : color.text }}>{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {tag ? (
        <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: color.accent }}>
          <Text style={{ fontFamily: font.bodyBold, fontSize: 11, lineHeight: 14, color: color.onAccent, textTransform: 'uppercase', letterSpacing: 0.8 }}>{tag}</Text>
        </View>
      ) : null}
      {trailing ? <Text variant="muted" numberOfLines={1} style={{ maxWidth: '45%', textAlign: 'right' }}>{trailing}</Text> : null}
      {onPress ? <Icon name="right" size={13} color={color.muted} /> : null}
    </View>
  )
  if (!onPress) return <View accessible accessibilityLabel={label ?? [title, subtitle, trailing].filter(Boolean).join(', ')}>{body}</View>
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? [title, subtitle, trailing, tag].filter(Boolean).join(', ')}
      onPress={() => { platform().signals.haptic('tap'); onPress() }}
      style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
      {body}
    </Pressable>
  )
}

/** Abschnitts-Überschrift klein (wie .pe-section im Web) */
export function Section({ title }: { title: string }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: font.bodyBold, fontSize: 12.5, lineHeight: 16, color: color.muted, textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 14, marginBottom: 2 }}>
      {title}
    </Text>
  )
}

/** Hinweis-Kasten (Volt getönt) */
export function Notice({ text, tone = 'accent' }: { text: string; tone?: 'accent' | 'warn' }) {
  return (
    <Text variant="muted" accessibilityLiveRegion="polite"
      style={{ color: color.text, backgroundColor: tone === 'warn' ? color.dangerDim : color.accentDim, padding: 12, borderRadius: radius.lg, overflow: 'hidden' }}>
      {text}
    </Text>
  )
}

/** Name eingeben (Neues Workout, Umbenennen): Feld + Button direkt darunter (bleibt über der Tastatur) */
export function NameForm({ initial = '', ok, onSave }: { initial?: string; ok: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const clean = name.replace(/\s+/g, ' ').trim()
  const save = () => { if (clean) onSave(clean.slice(0, 80)) }
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('editor.name')}</Text>
        <TextInput
          autoFocus value={name} onChangeText={setName} maxLength={80} placeholder={tr('editor.namePlaceholder')}
          placeholderTextColor={color.muted} returnKeyType="done" onSubmitEditing={save} accessibilityLabel={tr('editor.name')}
          selectionColor={color.accent} keyboardAppearance="dark" autoCapitalize="sentences"
          style={{
            minHeight: 52, paddingHorizontal: 16, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line,
            backgroundColor: color.card, color: color.text, fontFamily: font.bodyMedium, fontSize: 17,
          }} />
      </View>
      <Button variant="primary" size="lg" icon="check" title={ok} disabled={!clean} onPress={save} />
    </View>
  )
}
