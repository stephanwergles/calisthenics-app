/* Log-Tab: Monat (Kalender, Bilanz, Feed) und Fortschritt pro Übung. Profil oben rechts wie im
   Heute-Screen. (Web: src/client/components/HistoryView.tsx) */
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { HeaderButton } from '@/navigation'
import { font, GUTTER, Segmented, space, Text } from '@/ui'
import { Month } from './month'
import { Progress } from './progress'

type Sub = 'cal' | 'prog'

export function Log() {
  const { t } = useApp()
  const [sub, setSub] = useState<Sub>('cal')
  const [month, setMonth] = useState(t.today.slice(0, 7))
  const syncError = !!t.sync.account && t.sync.phase === 'error'
  return (
    <>
      <HeaderButton icon={syncError ? 'warning' : 'user'} label={tr('app.profileButton', { status: '' })} onPress={() => router.push('/profile')} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 40, gap: space.lg }}>
        <View style={{ gap: 6 }}>
          <Text variant="small" style={{ fontFamily: font.bodySemi, textTransform: 'uppercase', letterSpacing: 1.6 }}>
            {sub === 'cal' ? tn('history.totalSessions', t.sessions.filter(L.isTrained).length) : tr('history.perExercise')}
          </Text>
          <Text variant="hero" accessibilityRole="header">{tr('history.title')}</Text>
        </View>
        <Segmented<Sub> label={tr('history.view')} value={sub} onChange={setSub}
          options={[{ id: 'cal', title: tr('history.month') }, { id: 'prog', title: tr('history.progress') }]} />
        {sub === 'cal' ? <Month t={t} month={month} setMonth={setMonth} /> : <Progress t={t} />}
      </ScrollView>
    </>
  )
}
