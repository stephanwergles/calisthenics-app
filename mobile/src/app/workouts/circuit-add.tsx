/* Übung für einen Runden-Block wählen: alle Übungen des Katalogs (nicht nur die aktuelle
   Leiterstufe), nach Körperregion und Leiter sortiert, mit Suche. Hängt sie an den Entwurf an. */
import { useMemo, useState } from 'react'
import { TextInput, View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { circuitDraft } from '@/state/circuit-draft'
import { color, font, radius, SheetScreen } from '@/ui'
import { Rows, Section } from '@/screens/plan/parts'

export default function CircuitAddScreen() {
  const { t } = useApp()
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const seen = new Set<string>()
    const needle = q.trim().toLowerCase()
    return L.ladderChoices(t.ix, t.state).map(g => ({
      ...g,
      items: g.items.flatMap(it => (t.ix.progressions.get(it.pid)?.steps ?? []).flatMap(s => {
        const e = t.ix.exercises.get(s.exercise)
        if (!e || seen.has(e.id) || (needle && !e.name.toLowerCase().includes(needle))) return []
        seen.add(e.id)
        return [{ e, target: s.target }]
      })),
    })).filter(g => g.items.length)
  }, [t.ix, t.state, q])
  const pick = (exercise: string, reps: number) => {
    circuitDraft.update(c => ({ ...c, items: [...c.items, { exercise, reps }] }))
    router.back()
  }
  return (
    <SheetScreen title={tr('editor.circuitPick')} sub={tr('editor.circuitPickSub')}>
      <TextInput value={q} onChangeText={setQ} placeholder={tr('editor.search')} placeholderTextColor={color.muted} clearButtonMode="while-editing"
        accessibilityLabel={tr('editor.search')} selectionColor={color.accent} keyboardAppearance="dark" autoCorrect={false}
        style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, backgroundColor: color.card, color: color.text, fontFamily: font.bodyMedium, fontSize: 16 }} />
      {groups.map(g => (
        <View key={g.id} style={{ gap: 8 }}>
          <Section title={g.label} />
          <Rows rows={g.items.map(({ e, target }) => ({
            key: e.id, title: e.name, exercise: e,
            subtitle: e.unit === 'seconds' ? tr('editor.circuitSeconds') : tr('editor.circuitReps'),
            // Vorschlag: untere Grenze der Stufe (Runden laufen ohne lange Pausen)
            onPress: () => pick(e.id, Math.max(1, target.min ?? 5)),
          }))} />
        </View>
      ))}
    </SheetScreen>
  )
}
