/* Workouts als horizontale Leiste (Heute und Plan-Tab): höchstens fünf Workouts (heutiges zuerst,
   dann zuletzt trainierte), auf Heute danach die Vorlagen, am Ende „Neues Workout“. Alle Workouts
   über „Meine Workouts“ in der Überschrift. Ein Tipp öffnet die Übersicht des Workouts – gestartet wird dort. */
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, font, GUTTER, Icon, type IconName, radius, SectionTitle, Text } from '@/ui'
import { workoutSize } from './workouts'

const CARD = { width: 168, minHeight: 132, padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous' as const, borderWidth: 1 }

const MAX = 5

export function WorkoutStrip({ mode }: { mode: 'home' | 'plan' }) {
  const { t } = useApp()
  const list = L.recentWorkouts(t.ix, t.sessions, t.workout, MAX)
  const open = (id: string) => router.push({ pathname: '/workouts/[id]', params: { id } })
  return (
    <View>
      <SectionTitle title={tr('home.workouts')}
        right={<Button size="sm" variant="ghost" title={tr('home.workoutsMine')} icon="right" onPress={() => router.push('/workouts')} />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -GUTTER }} contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 10 }}>
        {list.map(w => {
          const today = w.id === t.workout
          const days = L.plannedDays(t.ix, w.id).map(d => L.WEEKDAY_SHORT[d]).join(' · ')
          return (
            <Pressable key={w.id} accessibilityRole="button" onPress={() => open(w.id)}
              accessibilityLabel={`${w.name}, ${today ? tr('home.workoutToday') : days || tr('plan.view.noDay')}`}
              style={({ pressed }) => ({ ...CARD, backgroundColor: color.card, borderColor: today ? color.accentLine : color.line, opacity: pressed ? 0.8 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="eyebrow" numberOfLines={1} style={{ fontSize: 11, color: today || days ? color.accent : color.muted }}>
                  {today ? tr('home.workoutToday') : days || tr('plan.view.noDay')}
                </Text>
                <Icon name="right" size={13} color={color.muted} />
              </View>
              <Text variant="title" style={{ fontSize: 19, lineHeight: 21 }} numberOfLines={2}>{w.name}</Text>
              <Text variant="small" numberOfLines={2} style={{ flex: 1 }}>{L.workoutFocus(t.ix, w)}</Text>
              <Text variant="small" numberOfLines={2} style={{ fontFamily: font.bodySemi }}>{workoutSize(w)}</Text>
            </Pressable>
          )
        })}
        {mode === 'home' && <ActionCard icon="grid" title={tr('home.workoutsMore')} sub={tr('home.workoutsMoreSub')}
          onPress={() => router.push({ pathname: '/templates', params: { kind: 'workout' } })} />}
        <ActionCard icon="plus" title={tr('home.workoutNew')} sub={tr('home.workoutNewSub')} onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: 'new' } })} />
      </ScrollView>
    </View>
  )
}

/** Karte mit gestricheltem Rand für eine Aktion (neu anlegen, Vorlagen) */
function ActionCard({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`} onPress={onPress}
      style={({ pressed }) => ({ ...CARD, borderStyle: 'dashed', borderColor: color.line, justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={22} color={color.accent} />
      <Text variant="title" style={{ fontSize: 17, textAlign: 'center' }}>{title}</Text>
      <Text variant="small" style={{ textAlign: 'center' }}>{sub}</Text>
    </Pressable>
  )
}
