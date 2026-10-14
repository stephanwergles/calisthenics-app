/* Session-Leiste als Mini-Player über der Tab-Leiste (NativeTabs.BottomAccessory): Dauer +
   Workout (Tipp öffnet das Training), rechts Beenden. Während einer Pause: Timer (Tipp beendet
   die Pause). Zustand liegt im AppProvider – die Leiste rendert in zwei Platzierungen. */
import { Pressable, View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { useNow } from '@lever/core/useNow.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, font, Icon, Text } from '@/ui'

export function SessionBar({ compact }: { compact?: boolean }) {
  const { t, rest, openTraining, askEnd } = useApp()
  const now = useNow(!!t.active)
  if (!t.active) return null
  const resting = rest.running || rest.ringing
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: compact ? 10 : 14 }}>
      {resting ? (
        <Pressable onPress={rest.stop} accessibilityRole="button" accessibilityLabel={tr('training.bar.stopRest')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="timer" size={18} color={color.accent} />
          <Text style={{ fontFamily: font.display, fontSize: 22, color: rest.ringing ? color.accent : color.text, fontVariant: ['tabular-nums'] }}>
            {rest.ringing ? tr('training.bar.ringing') : L.fmtClock(rest.remaining)}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => openTraining(undefined)} accessibilityRole="button" accessibilityLabel={tr('training.bar.open')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, lineHeight: 20, color: color.text, fontVariant: ['tabular-nums'] }}>
              {L.fmtDuration(Math.max(0, now - t.active.start) / 1000)}
            </Text>
            {!compact && <Text variant="small" numberOfLines={1}>{t.ix.workouts.get(t.active.workout)?.name ?? tr('training.bar.fallback')}</Text>}
          </View>
        </Pressable>
      )}
      <Button icon="stop" size="sm" variant="ghost" label={tr('training.bar.stop')} onPress={() => void askEnd()} />
    </View>
  )
}
