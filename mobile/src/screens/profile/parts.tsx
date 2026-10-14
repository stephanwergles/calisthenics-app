/* Bausteine der Profil- und Onboarding-Seiten: natives Textfeld, Kacheln mit Bild (Ziele,
   Ausrüstung), Fußzeile mit „Weiter“ im Onboarding. */
import { Pressable, TextInput, useWindowDimensions, View, type TextInputInstance, type TextInputProps } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Exercise } from '@lever/domain/model.ts'
import { Button, color, ExerciseStill, font, GUTTER, Icon, radius, Text, type IconName } from '@/ui'
import type { Next } from './shared'

/** Textfeld mit Beschriftung darüber (Fläche = anfassbar) */
export function Field({ label, style, multiline, ref, ...rest }: Omit<TextInputProps, 'ref'> & { label: string; ref?: React.Ref<TextInputInstance> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 }}>{label}</Text>
      <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={color.muted} keyboardAppearance="dark"
        selectionColor={color.accent} multiline={multiline}
        style={[{
          minHeight: multiline ? 140 : 50, paddingHorizontal: 16, paddingVertical: multiline ? 14 : 0,
          backgroundColor: color.card, borderWidth: 1, borderColor: color.line, borderRadius: radius.lg, borderCurve: 'continuous',
          color: color.text, fontFamily: font.body, fontSize: 17, textAlignVertical: multiline ? 'top' : 'center',
        }, style]}
        {...rest} />
    </View>
  )
}

export interface Tile {
  id: string; title: string; subtitle?: string
  /** Stand (z. B. „Realistisch als Nächstes“); accent = Volt */
  detail?: string; accent?: boolean
  exercise?: Exercise; icon?: IconName
  on: boolean
  /** nicht wählbar (z. B. erreicht) – nur Anzeige */
  locked?: boolean
}

/** Zwei Kacheln je Zeile: Bild, Name, ein Satz Erklärung, Stand; Häkchen oben rechts */
export function Tiles({ items, onToggle }: { items: Tile[]; onToggle: (id: string, on: boolean) => void }) {
  const { width } = useWindowDimensions()
  const w = (Math.min(width, 700) - GUTTER * 2 - 12) / 2
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {items.map(x => {
        const body = (
          <>
            <View style={{ height: w * 0.78, backgroundColor: 'rgba(255,255,255,0.03)' }}>
              {x.exercise ? <ExerciseStill exercise={x.exercise} style={{ width: '100%', height: '100%' }} size={34} />
                : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name={x.icon ?? 'figure'} size={34} color={color.muted} /></View>}
              {!x.locked && (
                <View style={{
                  position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13,
                  backgroundColor: x.on ? color.accent : 'rgba(16,16,16,0.6)', borderWidth: x.on ? 0 : 1.5, borderColor: color.chalk,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {x.on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
                </View>
              )}
              {x.locked && (
                <View style={{ position: 'absolute', top: 10, right: 10 }}><Icon name="checkCircle" size={24} color={color.chalk} /></View>
              )}
            </View>
            <View style={{ padding: 12, gap: 4 }}>
              <Text variant="title" style={{ fontSize: 18, lineHeight: 19 }}>{x.title}</Text>
              {x.subtitle ? <Text variant="small" style={{ color: x.locked ? color.muted : color.text, opacity: 0.85 }}>{x.subtitle}</Text> : null}
              {x.detail ? <Text variant="small" style={{ fontFamily: font.bodySemi, color: x.accent ? color.accent : color.muted }}>{x.detail}</Text> : null}
            </View>
          </>
        )
        const frame = {
          width: w, borderRadius: radius.card, borderCurve: 'continuous' as const, overflow: 'hidden' as const, borderWidth: 1,
          borderColor: x.on ? color.accentLine : color.line, backgroundColor: x.on ? color.accentDim : color.card,
        }
        if (x.locked) return <View key={x.id} style={[frame, { opacity: 0.75 }]} accessible accessibilityLabel={[x.title, x.subtitle, x.detail].filter(Boolean).join(', ')}>{body}</View>
        return (
          <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: x.on }}
            accessibilityLabel={[x.title, x.subtitle, x.detail].filter(Boolean).join(', ')}
            onPress={() => { platform().signals.haptic('tap'); onToggle(x.id, !x.on) }}
            style={({ pressed }) => [frame, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            {body}
          </Pressable>
        )
      })}
    </View>
  )
}

/** Fußzeile im Onboarding: Weiter (Hauptaktion) und optional Überspringen */
export function NextFooter({ next }: { next: Next }) {
  return (
    <>
      <Button variant="primary" size="lg" icon="arrowRight" title={next.title} onPress={next.onNext} />
      {next.onSkip && <Button variant="ghost" title={tr('onboarding.skipStep')} onPress={next.onSkip} />}
    </>
  )
}

/** Abschnitts-Überschrift klein (über Listen-Gruppen, wie iOS-Einstellungen) */
export function GroupLabel({ title }: { title: string }) {
  return (
    <Text variant="small" accessibilityRole="header"
      style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 12, marginTop: 14, marginBottom: -4, marginLeft: 4 }}>
      {title}
    </Text>
  )
}
