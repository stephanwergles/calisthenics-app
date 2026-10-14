/* Übung hinzufügen: alle Übungen des Katalogs nach Körperregion und Leiter, mit Suche. Ist die
   gewählte Übung deine aktuelle Stufe, wächst sie mit; jede andere Stufe (z. B. normale
   Liegestütze, obwohl du schon erhöht machst) wird als feste Übung angelegt. */
import { useMemo, useState } from 'react'
import { TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { color, font, radius, SheetScreen } from '@/ui'
import { Rows, Section } from '@/screens/plan/parts'

export default function AddExerciseScreen() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const w = t.ix.workouts.get(id)
  const [q, setQ] = useState('')
  const taken = new Set(w?.slots.map(s => s.progression) ?? [])
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return L.ladderChoices(t.ix, t.state, taken).map(g => ({
      ...g,
      items: g.items.flatMap(it => {
        const own = L.currentStep(t.ix, t.state, it.pid)
        return (t.ix.progressions.get(it.pid)?.steps ?? []).flatMap((s, i) => {
          const e = t.ix.exercises.get(s.exercise)
          if (!e || (needle && !e.name.toLowerCase().includes(needle))) return []
          const mine = i === own.index
          // ohne Suche nur deine aktuelle Stufe je Leiter – sonst würde die Liste sehr lang
          if (!needle && !mine) return []
          return [{ pid: it.pid, e, mine, target: s.target, stage: i + 1, total: own.total }]
        })
      }),
    })).filter(g => g.items.length)
  }, [t.ix, t.state, q]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <SheetScreen title={tr('editor.addExercise')} sub={w ? tr('editor.addTo', { name: w.name }) : tr('editor.ladderSub')}>
      <TextInput value={q} onChangeText={setQ} placeholder={tr('editor.searchAll')} placeholderTextColor={color.muted} clearButtonMode="while-editing"
        accessibilityLabel={tr('editor.search')} selectionColor={color.accent} keyboardAppearance="dark" autoCorrect={false}
        style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, backgroundColor: color.card, color: color.text, fontFamily: font.bodyMedium, fontSize: 16 }} />
      {groups.map(g => (
        <View key={g.id} style={{ gap: 8 }}>
          <Section title={g.label} />
          <Rows rows={g.items.map(x => ({
            key: `${x.pid}-${x.e.id}`, title: x.e.name, exercise: x.e,
            subtitle: x.mine ? tr('logic.stageTarget', { i: x.stage, n: x.total, target: x.target.label }) : `${tr('editor.fixed')} · ${x.target.label}`,
            onPress: () => {
              if (!w) return
              t.editPlan(p => L.withWorkout(p, x.mine ? L.withSlot(t.ix, w, x.pid) : L.withSlotExercise(t.ix, w, x.pid, x.e.id)))
              // zurück zum Editor und gleich die Sätze der neuen Übung zeigen
              router.back()
              router.push({ pathname: '/workouts/slot', params: { id: w.id, pid: x.pid } })
            },
          }))} />
        </View>
      ))}
    </SheetScreen>
  )
}
