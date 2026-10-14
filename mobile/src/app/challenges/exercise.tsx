/* Übung für eine eigene Challenge wählen: alle Übungen nach Leiter (Körperregion), „ohne Übung“ oben */
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { SheetScreen } from '@/ui'
import { ModalToolbar, Rows, Section, useIsFirst } from '@/screens/plan/parts'

const REGION_ORDER = ['pull', 'push', 'core', 'legs']

export default function PickExercise() {
  const { t } = useApp()
  const { id, current } = useLocalSearchParams<{ id?: string; current?: string }>()
  const pick = (exercise: string) => router.dismissTo({ pathname: '/challenges/edit', params: { ...(id ? { id } : {}), exercise } })
  const progs = [...t.ix.progressions.values()]
  const regions = [...new Set([...REGION_ORDER, ...progs.map(p => p.region ?? 'core')])]
  const seen = new Set<string>()
  return (
    <SheetScreen title={tr('challenge.pickExercise')}>
      <Rows rows={[{ key: 'none', title: tr('challenge.noExercise'), icon: 'flame', iconTile: true, tag: !current ? tr('challenge.selected') : undefined, onPress: () => pick('') }]} />
      {regions.map(r => {
        const items = progs.filter(p => (p.region ?? 'core') === r).flatMap(p => p.steps.map(s => t.ix.exercises.get(s.exercise)!))
          .filter(e => e && !seen.has(e.id) && seen.add(e.id))
        if (!items.length) return null
        return (
          <View key={r} style={{ gap: 8 }}>
            <Section title={L.regionLabel(r as never)} />
            <Rows rows={items.map(e => ({ key: e.id, title: e.name, exercise: e, tag: e.id === current ? tr('challenge.selected') : undefined, onPress: () => pick(e.id) }))} />
          </View>
        )
      })}
    </SheetScreen>
  )
}
