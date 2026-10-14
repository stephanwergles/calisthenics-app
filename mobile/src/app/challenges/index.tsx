/* Challenges (Übersicht): eigene Challenges, dann die Vorlagen – je mit Vorgabe und Bestwert */
import { View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Challenge } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { Button, SheetScreen } from '@/ui'
import { ModalToolbar, Rows, Section, useIsFirst } from '@/screens/plan/parts'

export default function ChallengesScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const templates = catalogData(t.ix.catalog).challenges
  const mine = t.state.challenges ?? []
  const rows = (list: Challenge[]) => list.map(c => {
    const best = L.challengeBest(c, t.activities)
    const ex = c.exercise ? t.ix.exercises.get(c.exercise) : undefined
    return {
      key: c.id, title: c.name, subtitle: L.fmtChallengeRule(c), exercise: ex, icon: 'flame' as const, iconTile: true,
      trailing: best ? L.fmtChallengeValue(c, best.value!) : undefined,
      onPress: () => router.push({ pathname: '/challenges/[id]', params: { id: c.id } }),
    }
  })
  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={tr('challenge.title')} sub={tr('challenge.sub')}>
        <Button icon="plus" title={tr('challenge.create')} onPress={() => router.push('/challenges/edit')} />
        {mine.length > 0 && <View style={{ gap: 8 }}><Section title={tr('challenge.mine')} /><Rows rows={rows(mine)} /></View>}
        <View style={{ gap: 8 }}><Section title={tr('challenge.templates')} /><Rows rows={rows(templates)} /></View>
      </SheetScreen>
    </>
  )
}
