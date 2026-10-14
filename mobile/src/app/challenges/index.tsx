/* Challenges (Übersicht): alle Vorlagen mit Vorgabe und Bestwert */
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { SheetScreen } from '@/ui'
import { ModalToolbar, Rows, useIsFirst } from '@/screens/plan/parts'

export default function ChallengesScreen() {
  const { t } = useApp()
  const first = useIsFirst()
  const { challenges } = catalogData(t.ix.catalog)
  return (
    <>
      <ModalToolbar close={first} />
      <SheetScreen title={tr('challenge.title')} sub={tr('challenge.sub')}>
        <Rows rows={challenges.map(c => {
          const best = L.challengeBest(c, t.activities)
          const ex = c.exercise ? t.ix.exercises.get(c.exercise) : undefined
          return {
            key: c.id, title: c.name, subtitle: L.fmtChallengeRule(c), exercise: ex, icon: 'flame' as const, iconTile: true,
            trailing: best ? L.fmtChallengeValue(c, best.value!) : undefined,
            onPress: () => router.push({ pathname: '/challenges/[id]', params: { id: c.id } }),
          }
        })} />
      </SheetScreen>
    </>
  )
}
