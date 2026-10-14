/* Zusammenfassung nach dem Training (Web: SummaryOverlay): Kennzahlen, neue Bestwerte, Vergleich je
   Übung mit dem letzten Mal, Notiz zur Einheit. Fertig oder Wegwischen speichert die Notiz. */
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { Session } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, color, font, Icon, radius, SectionTitle, SheetScreen, space, Text } from '@/ui'
import { NoteInput } from '@/screens/training/parts'

export default function SummaryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useApp()
  const session = t.sessions.find(s => s.id === id)
  if (!session) return <SheetScreen headerSpace={false} title={`${tr('training.strong')}.`} />
  return <Summary key={id} session={session} />
}

const BEFORE = '#6a6a6a'

function Summary({ session }: { session: Session }) {
  const { t } = useApp()
  const sum = L.sessionSummary(t.ix, t.sessions, session)
  const w = t.ix.workouts.get(session.workout)
  // Notiz nur an der heutigen Einheit (gespeichert wird über updateToday)
  const editable = session.id === t.todaySession?.id
  const [note, setNote] = useState(session.note ?? '')
  const [noteOpen, setNoteOpen] = useState(!!session.note)
  const max = Math.max(1, ...sum.compare.flatMap(c => [c.before, c.now]))
  const h = Math.floor(sum.durationSec / 3600), m = Math.round((sum.durationSec % 3600) / 60)

  // Speichern beim Schließen – auch beim Wegwischen des Sheets
  const original = useRef(session.note ?? '')
  const save = useRef(() => {})
  useEffect(() => {
    save.current = () => {
      if (editable && (L.cleanNote(note) ?? '') !== (L.cleanNote(original.current) ?? '')) t.updateToday(s => L.withNote(s, note))
    }
  })
  useEffect(() => () => save.current(), [])

  const stats = [
    { value: h ? `${h}:${String(m).padStart(2, '0')}` : String(m), label: h ? tr('training.summary.hours') : tn('training.summary.minutes', m), accent: true },
    { value: String(sum.sets), label: tn('training.summary.sets', sum.sets) },
    { value: String(sum.reps), label: tr('training.unitReps'), delta: sum.repsDelta ? `${sum.repsDelta > 0 ? '+' : '−'}${Math.abs(sum.repsDelta)}` : undefined, up: (sum.repsDelta ?? 0) > 0 },
  ]

  return (
    <SheetScreen headerSpace={false}
      footer={
        <ButtonRow>
          {editable && <Button icon="note" size="lg" variant={noteOpen ? 'outline' : 'secondary'} label={tr('training.noteSession')} onPress={() => setNoteOpen(o => !o)} />}
          <Button variant="primary" size="lg" icon="check" title={tr('training.done')} onPress={() => router.back()} style={{ flex: 1 }} />
        </ButtonRow>
      }>
      <View style={{ gap: 6 }}>
        <Text variant="small" style={{ fontFamily: font.bodySemi, textTransform: 'uppercase', letterSpacing: 1.4 }}>
          {L.fmtDate(session.date)} · {w ? `${w.name} · ${L.workoutFocus(t.ix, w)}` : session.workout}
        </Text>
        <Text variant="hero" style={{ fontSize: 72, lineHeight: 68 }} accessibilityRole="header">
          {tr('training.strong')}<Text variant="hero" style={{ fontSize: 72, lineHeight: 68, color: color.accent }}>.</Text>
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stats.map(s => (
          <View key={s.label} accessible accessibilityLabel={`${s.value} ${s.label}${s.delta ? `, ${s.delta}` : ''}`}
            style={{ flex: 1, padding: 14, gap: 2, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: s.accent ? color.accentDim : color.card, borderWidth: 1, borderColor: s.accent ? color.accentLine : color.line }}>
            <Text variant="num" style={{ fontSize: 38, lineHeight: 40, color: s.accent ? color.accent : color.text }}>{s.value}</Text>
            <Text variant="small" numberOfLines={1} style={{ fontFamily: font.bodySemi }}>
              {s.label}{s.delta ? <Text variant="small" style={{ fontFamily: font.bodyBold, color: s.up ? color.accent : color.muted }}> · {s.delta}</Text> : null}
            </Text>
          </View>
        ))}
      </View>

      {/* Runden-Blöcke: Ergebnis je Block */}
      {(session.circuits?.length ?? 0) > 0 && (
        <View style={{ gap: 8 }}>
          <SectionTitle title={tr('circuit.section')} />
          {L.sessionCircuits(t.ix, session).map(c => (
            <View key={c.id} accessible accessibilityLabel={`${c.name}, ${c.result}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: color.card, borderWidth: 1, borderColor: color.line }}>
              <Icon name="sync" size={20} color={color.accent} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{c.name}</Text>
                {c.items ? <Text variant="small">{c.items}</Text> : null}
              </View>
              <Text variant="num" style={{ fontSize: 24, color: color.accent }}>{c.result}</Text>
            </View>
          ))}
        </View>
      )}

      {sum.records.length > 0 && (
        <View>
          <SectionTitle title={tr('training.summary.records')} />
          <View style={{ gap: 8 }}>
            {sum.records.map(r => {
              const text = r.kind === 'weight'
                ? (r.before ? tr('training.summary.recordWeight', { value: r.value, before: r.before }) : tr('training.summary.recordWeightFirst', { value: r.value }))
                : tr('training.summary.recordBest', { value: `${r.value}${r.exercise.unit === 'seconds' ? ' s' : ''}`, before: r.before })
              return (
                <View key={`${r.exercise.id}-${r.kind}`} accessible accessibilityLabel={`${r.exercise.name}, ${text}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: color.card, borderWidth: 1, borderColor: color.line }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.accentDim, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trophy" size={18} color={color.accent} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label">{r.exercise.name}</Text>
                    <Text variant="small">{text}</Text>
                  </View>
                  <Text variant="num" style={{ color: color.accent }}>{r.kind === 'weight' ? `+${r.value}` : r.value}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {sum.compare.length > 0 && (
        <View>
          <SectionTitle title={tr('training.summary.compare')} />
          <View style={{ gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: color.card, borderWidth: 1, borderColor: color.line }}>
            {sum.compare.map(c => {
              const d = c.now - c.before
              const delta = `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}`
              return (
                <View key={c.exercise.id} style={{ gap: 6 }} accessible
                  accessibilityLabel={`${c.exercise.name}: ${tr('training.summary.compareBars', { before: c.before, now: c.now })}, ${delta}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                    <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{c.exercise.name}</Text>
                    <Text style={{ fontFamily: font.display, fontSize: 18, color: d > 0 ? color.accent : color.muted, fontVariant: ['tabular-nums'] }}>{delta}</Text>
                  </View>
                  <View style={{ gap: 3 }}>
                    <View style={{ height: 6, width: `${(c.before / max) * 100}%`, minWidth: 4, borderRadius: 3, backgroundColor: BEFORE }} />
                    <View style={{ height: 6, width: `${(c.now / max) * 100}%`, minWidth: 4, borderRadius: 3, backgroundColor: color.accent }} />
                  </View>
                </View>
              )
            })}
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }} accessibilityElementsHidden>
              <Legend tint={BEFORE} text={tr('training.summary.lastTime')} />
              <Legend tint={color.accent} text={tr('training.summary.today')} />
            </View>
          </View>
        </View>
      )}

      {editable && noteOpen && (
        <NoteInput label={tr('training.noteSession')} value={note} onChangeText={setNote} autoFocus={!session.note}
          placeholder={tr('training.notePlaceholder')} style={{ marginTop: space.sm }} />
      )}
      {!editable && session.note ? (
        <View style={{ gap: 4, marginTop: space.sm }}>
          <Text variant="small" style={{ fontFamily: font.bodySemi }}>{tr('training.noteSession')}</Text>
          <Text variant="body" selectable>{session.note}</Text>
        </View>
      ) : null}
    </SheetScreen>
  )
}

function Legend({ tint, text }: { tint: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: tint }} />
      <Text variant="small">{text}</Text>
    </View>
  )
}
