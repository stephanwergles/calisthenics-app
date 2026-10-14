/* Trainingstage & Dauer: Minuten je Einheit, Wochentage, Wochenaufbau. Jede Aufbau-Option zeigt
   die konkrete Woche (welcher Tag welches Thema bekommt – dieselbe Zuordnung wie der Generator,
   L.splitWeek). Ändert den Plan erst, wenn ein Vorschlag bestätigt wird. (Web: DaysSheet) */
import { Pressable, View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { SplitTemplate, Weekday } from '@lever/domain/model.ts'
import { color, DayPicker, font, Icon, radius, SectionTitle, SheetScreen, Stepper, Text } from '@/ui'
import { useApp } from '@/state/app'
import { NextFooter } from './parts'
import { useProfile, type Next } from './shared'

const THEMES = ['full', 'pull', 'push', 'lower', 'upper'] as const
type Theme = (typeof THEMES)[number]
const themeName = (th: SplitTemplate['themes'][number]) => (THEMES.includes(th.id as Theme) ? tr(`profile.days.theme.${th.id as Theme}`) : th.name)

export function DaysPage({ next }: { next?: Next }) {
  const { t } = useApp()
  const { profile, change } = useProfile(t)
  const data = catalogData(t.ix.catalog)
  const items = L.WEEK_ORDER.map(d => ({ id: d, short: L.WEEKDAY_SHORT[d], long: L.WEEKDAY_LONG[d], on: profile.days.includes(d) }))
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, days: L.WEEK_ORDER.filter(d => (d === id ? on : p.days.includes(d))) as Weekday[] }))
  const setMin = (m: number) => change(p => ({ ...p, minutes: Math.min(180, Math.max(30, m)) }))

  // Vorlagen mit so vielen Themen wie Tagen; „Lever entscheidet“ = was der Generator gerade nähme
  const fitting = data.splits.filter(x => x.themes.length === profile.days.length)
  const chosen = fitting.some(x => x.id === profile.split) ? profile.split! : 'auto'
  const autoId = L.generatorInput(t.ix, { ...t.state, profile: { ...profile, split: undefined } }, data.skills, fitting)?.split
  const auto = fitting.find(x => x.id === autoId)
  const week = (x: SplitTemplate) => L.splitWeek(t.ix, t.state, data.skills, x, data.meta)
  const options = [
    { id: 'auto', title: tr('profile.days.auto'), sub: auto ? tr('profile.days.autoNow', { name: auto.name }) : tr('profile.days.autoLater'), week: auto ? week(auto) : [] },
    ...fitting.map(x => ({ id: x.id, title: x.name, sub: undefined, week: week(x) })),
  ]
  const pick = (id: string) => change(p => { const { split: _, ...rest } = p; return id === 'auto' ? rest : { ...rest, split: id } })

  return (
    <SheetScreen title={tr('profile.row.days')} sub={tr('profile.days.sub')} footer={next ? <NextFooter next={next} /> : undefined}>
      <Stepper label={tr('profile.days.minutes')} value={String(profile.minutes)}
        onMinus={() => setMin(profile.minutes - 5)} onPlus={() => setMin(profile.minutes + 5)}
        minusLabel={tr('profile.days.shorter')} plusLabel={tr('profile.days.longer')} />
      <SectionTitle title={tr('profile.days.weekdays')} />
      <DayPicker items={items} onToggle={toggle} />
      {fitting.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionTitle title={tr('profile.days.split')} />
          <Text variant="muted">{tr('profile.days.splitIntro')}</Text>
          {options.map(o => {
            const on = chosen === o.id
            const label = [o.title, o.sub, tr('profile.days.weekAria', { list: o.week.map(w => `${L.WEEKDAY_LONG[w.day]}: ${themeName(w.theme)}`).join(', ') })].filter(Boolean).join('. ')
            return (
              <Pressable key={o.id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
                onPress={() => { if (!on) { platform().signals.haptic('tap'); pick(o.id) } }}
                style={({ pressed }) => ({
                  padding: 14, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1,
                  borderColor: on ? color.accentLine : color.line, backgroundColor: on ? color.accentDim : color.card,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 1.5, borderColor: color.muted, backgroundColor: on ? color.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text variant="label">{o.title}</Text>
                    {o.sub ? <Text variant="small">{o.sub}</Text> : null}
                  </View>
                </View>
                {o.week.length > 0 && (
                  <View style={{ gap: 6, paddingLeft: 36 }}>
                    {o.week.map(w => (
                      <View key={w.day} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                        <Text style={{ width: 30, fontFamily: font.display, fontSize: 16, color: on ? color.accent : color.text, textTransform: 'uppercase' }}>{L.WEEKDAY_SHORT[w.day]}</Text>
                        <Text variant="small" style={{ flex: 1, color: color.text }}>{themeName(w.theme)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
    </SheetScreen>
  )
}
