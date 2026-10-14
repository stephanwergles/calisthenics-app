/* Log → Fortschritt: pro Workout die Übungen mit Wert der letzten Einheit, Delta zur vorigen
   Einheit derselben Stufe und Sparkline. Antippen klappt die Wertetabelle auf (zugleich die
   barrierefreie Alternative zum Diagramm). (Web: Progress/Tile in HistoryView) */
import { useMemo, useState } from 'react'
import { LayoutAnimation, Pressable, View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { getLocale, t as tr, tn } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import type { Training } from '@lever/core/useTraining.ts'
import { color, font, Icon, radius, Text } from '@/ui'
import { Spark, SparkKey } from './spark'

export function Progress({ t }: { t: Training }) {
  const locale = getLocale()
  const groups = useMemo(() => L.progressOverview(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, locale])
  const [open, setOpen] = useState<string | null>(null)
  if (!groups.length) return (
    <Text variant="muted" style={{ textAlign: 'center', paddingVertical: 24, paddingHorizontal: 12 }}>
      {tr('history.noData')}{'\n'}{tr('history.noDataHint')}
    </Text>
  )
  const toggle = (pid: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(o => (o === pid ? null : pid))
  }
  return (
    <View style={{ gap: 8 }}>
      <SparkKey />
      {groups.map(g => (
        <View key={g.workout.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 14, paddingHorizontal: 2 }}>
            <Text variant="title" accessibilityRole="header" style={{ fontSize: 20 }}>{g.workout.name}</Text>
            <Text variant="small" numberOfLines={1} style={{ flex: 1, fontFamily: font.bodyMedium, fontSize: 12 }}>{g.workout.focus}</Text>
          </View>
          {g.tiles.map(p => <Tile key={p.pid} p={p} open={open === p.pid} toggle={() => toggle(p.pid)} />)}
        </View>
      ))}
    </View>
  )
}

function Tile({ p, open, toggle }: { p: L.ProgressSummary; open: boolean; toggle: () => void }) {
  const ex = p.step.exercise
  const seconds = ex.unit === 'seconds'
  const unit = seconds ? 's' : tr('history.repsLabel')
  const flat = p.delta === null || p.delta === 0
  const delta = !p.last ? tr('history.newStep')
    : p.delta === null ? (p.step.index > 0 ? tr('history.firstOnStep') : tr('history.first'))
    : tr('history.deltaSince', { delta: `${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '± '}${Math.abs(p.delta)}`, date: L.fmtShortDate(p.prev!.date) })
  const meta = [
    p.step.total > 1 ? tr('logic.stage', { i: p.step.index + 1, n: p.step.total }) : null,
    tn('history.sessionCount', p.current.length),
    p.best !== null ? tr('history.bestSet', { value: p.best, unit: seconds ? ' s' : '' }) : null,
    p.weightKg ? tr('history.upToWeight', { kg: L.fmtNum(p.weightKg) }) : null,
    p.paused ? tr('history.paused') : p.ready ? tr('history.readyFor', { name: p.step.next!.name }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <View style={{ backgroundColor: color.card, borderWidth: 1, borderColor: p.ready && !p.paused ? color.accentLine : color.line, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', opacity: p.paused ? 0.55 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityHint={tr('history.expandHint')}
        accessibilityLabel={`${ex.name}, ${p.last ? `${p.last.sum} ${unit}` : '–'}, ${meta}, ${delta}`}
        onPress={() => { platform().signals.haptic('tap'); toggle() }}
        style={({ pressed }) => ({ paddingTop: 13, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: pressed ? 'rgba(255,255,255,0.03)' : 'transparent' })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <Text variant="title" style={{ flex: 1, fontSize: 19, lineHeight: 20 }}>{ex.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text variant="num" style={{ fontSize: 32, lineHeight: 32 }}>{p.last ? p.last.sum : '–'}</Text>
            <Text style={{ marginLeft: 3, fontFamily: font.bodyMedium, fontSize: 11.5, color: color.muted }}>{unit}</Text>
          </View>
        </View>
        <Text variant="small" style={{ fontSize: 12, marginTop: 2 }}>{meta}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ flexShrink: 1, fontFamily: flat ? font.bodyMedium : font.bodySemi, fontSize: 12.5, color: flat ? color.muted : (p.delta ?? 0) > 0 ? color.accent : color.text }}>{delta}</Text>
            <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}><Icon name="down" size={12} color={color.muted} /></View>
          </View>
          <Spark points={p.history} />
        </View>
      </Pressable>
      {open && <Table p={p} />}
    </View>
  )
}

/** Wertetabelle der letzten 12 Einheiten, neueste zuerst */
function Table({ p }: { p: L.ProgressSummary }) {
  const cell = { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: color.muted } as const
  const head = { fontFamily: font.bodySemi, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: color.muted } as const
  const row = { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: color.line } as const
  return (
    <View accessibilityLabel={tr('history.tableAria')} style={{ marginHorizontal: 16, marginBottom: 14 }}>
      <View style={row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[head, { width: 52 }]}>{tr('history.colDate')}</Text>
        <Text style={[head, { width: 42 }]}>{tr('history.colStep')}</Text>
        <Text style={[head, { flex: 1 }]}>{tr('history.colSets')}</Text>
        <Text style={[head, { width: 40, textAlign: 'right' }]}>Σ</Text>
      </View>
      {p.history.slice(-12).reverse().map((h, i) => {
        const sets = h.sets.map(x => `${x.value}${x.weightKg ? `+${L.fmtNum(x.weightKg)}kg` : ''}${x.note ? '*' : ''}`).join(' · ')
        const notes = L.notesOf(h.sets)
        return (
          <View key={`${h.date}-${h.step}-${i}`} style={row} accessible
            accessibilityLabel={`${L.fmtDate(h.date)}, ${tr('history.colStep')} ${h.step + 1}, ${tr('history.colSets')} ${sets.replaceAll('*', '')}, Σ ${h.sum}${notes.length ? `, ${notes.map(n => tr('history.setNote', { n: n.set, note: n.note })).join(', ')}` : ''}`}>
            <Text style={[cell, { width: 52 }]}>{L.fmtShortDate(h.date)}</Text>
            <Text style={[cell, { width: 42 }]}>{h.step + 1}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={cell}>{sets}</Text>
              {notes.map(n => (
                <Text key={n.set} style={[cell, { fontSize: 12, color: color.text }]}>
                  <Text style={{ color: color.accent }}>* </Text>{tr('history.setNote', { n: n.set, note: n.note })}
                </Text>
              ))}
            </View>
            <Text style={[cell, { width: 40, textAlign: 'right', color: color.text, fontVariant: ['tabular-nums'] }]}>{h.sum}</Text>
          </View>
        )
      })}
    </View>
  )
}
