/* Challenge durchführen (Vollbild): 3-2-1-Vorlauf, dann je nach Art
   – so viele wie möglich: Countdown-Ring, die ganze Fläche zählt (+1 je Tipp)
   – auf Zeit: Stoppuhr, Fläche zählt, endet bei der Zielzahl
   – Maximum Wiederholungen: Fläche zählt, „Fertig“ – Maximum Halten: Stoppuhr, „Stopp“
   danach Ergebnis mit Bestwert-Vergleich, Notiz, Speichern oder Verwerfen. */
import { useEffect, useRef, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Pressable, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { platform } from '@lever/core/platform.ts'
import { toast } from '@lever/core/toast.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Challenge } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { ask, Button, ButtonRow, color, CountdownRing, font, GUTTER, Icon, Text } from '@/ui'
import { NoteInput } from '@/screens/training/parts'
import { useChallengeActivity } from '@/live/use-challenge-activity'

const PREP = 3
/** Satzgrößen zum Eintragen mit einem Tipp */
const SET_SIZES = [5, 8, 10, 12, 15]
type Phase = 'prep' | 'run' | 'result'
const signals = () => platform().signals

export default function ChallengeRun() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const c = L.allChallenges(catalogData(t.ix.catalog).challenges, t.state).find(x => x.id === id)
  if (!c) return null
  return <Run c={c} />
}

function Run({ c }: { c: Challenge }) {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const [phase, setPhase] = useState<Phase>('prep')
  const [now, setNow] = useState(Date.now())
  const [prepEnd] = useState(() => Date.now() + PREP * 1000)
  const startRef = useRef(0)
  const [count, setCount] = useState(0)
  // Sätze: ein Tipp auf eine Satzgröße trägt den ganzen Satz ein; Einzeltipps auf die Fläche bilden
  // einen eigenen Satz, sobald der nächste ganze Satz kommt oder die Challenge endet
  const [parts, setParts] = useState<number[]>([])
  const partsSum = parts.reduce((a, b) => a + b, 0)
  const [result, setResult] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const timed = L.challengeMeasuresTime(c)
  const runEnd = c.kind === 'amrap' && startRef.current ? startRef.current + (c.seconds ?? 60) * 1000 : null
  // Sperrbildschirm und Dynamic Island, solange der Versuch läuft
  useChallengeActivity(c, phase === 'run' ? startRef.current : null, count)

  useEffect(() => { signals().prime(); void signals().keepAwake(true); return () => { void signals().keepAwake(false) } }, [])
  // ein Takt für Vorlauf, Countdown und Stoppuhr
  useEffect(() => {
    if (phase === 'result') return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'prep' && now >= prepEnd) { startRef.current = Date.now(); signals().haptic('success'); setPhase('run') }
    if (phase === 'run' && runEnd && now >= runEnd) finish(count)
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = startRef.current ? (now - startRef.current) / 1000 : 0
  const finish = (reps: number, done = parts) => {
    if (phase !== 'run') return
    signals().alarm(); signals().haptic('warning')
    // Rest aus Einzeltipps als letzter Satz
    const rest = reps - done.reduce((a, b) => a + b, 0)
    setParts(rest > 0 ? [...done, rest] : done)
    setResult(timed ? (Date.now() - startRef.current) / 1000 : reps)
    setPhase('result')
  }
  const add = (n: number) => {
    if (phase !== 'run') return
    // −1 ohne offene Einzeltipps: eine Wiederholung aus dem letzten eingetragenen Satz nehmen
    if (n < 0 && count === partsSum && parts.length) {
      const last = parts[parts.length - 1] - 1
      setParts(last > 0 ? [...parts.slice(0, -1), last] : parts.slice(0, -1)); setCount(count - 1); signals().haptic('tap')
      return
    }
    const next = Math.max(partsSum, count + n)
    signals().haptic('tap'); setCount(next)
    if (c.kind === 'fortime' && next >= (c.target ?? 0)) finish(next)
  }
  /** ganzen Satz mit n Wiederholungen eintragen */
  const addSet = (n: number) => {
    if (phase !== 'run') return
    // am Stück: ein einziger Satz – die Buttons zählen nur schneller hoch
    if (c.kind === 'max') { signals().haptic('success'); setCount(count + n); return }
    const open = count - partsSum
    const next = count + n
    const done = [...parts, ...(open > 0 ? [open] : []), n]
    signals().haptic('success'); setParts(done); setCount(next)
    if (c.kind === 'fortime' && next >= (c.target ?? 0)) finish(next, done)
  }
  const close = async () => {
    if (phase === 'result' || await ask({ title: tr('challenge.cancelTitle'), message: tr('challenge.cancelMessage'), ok: tr('challenge.cancelOk'), cancel: tr('challenge.keepGoing'), destructive: true })) router.back()
  }

  if (phase === 'result' && result !== null) {
    return <Result c={c} value={result} parts={parts.length > 1 ? parts : []} note={note} setNote={setNote} onSave={() => {
      t.addActivity(L.challengeAttempt(c, t.today, result, { note, ...(parts.length > 1 ? { parts } : {}) }))
      toast(tr('challenge.saved'), 'success'); router.back()
    }} onDiscard={() => router.back()} />
  }

  const counting = c.kind !== 'max' || c.unit === 'reps'
  const big = phase === 'prep' ? String(Math.max(1, Math.ceil((prepEnd - now) / 1000)))
    : c.kind === 'fortime' || (c.kind === 'max' && c.unit === 'reps') || c.kind === 'amrap' ? String(count)
    : L.fmtClock(Math.floor(elapsed))
  const sub = phase === 'prep' ? tr('challenge.getReady')
    : c.kind === 'amrap' ? L.fmtClock(Math.max(0, Math.ceil(((runEnd ?? 0) - now) / 1000)))
    : c.kind === 'fortime' ? `${L.fmtClock(Math.floor(elapsed))} · ${tr('challenge.left', { n: Math.max(0, (c.target ?? 0) - count) })}`
    : counting ? tr('challenge.tapToCount') : ''

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: GUTTER, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button icon="close" label={tr('challenge.cancel')} onPress={() => void close()} />
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" numberOfLines={1}>{L.fmtChallengeRule(c)}</Text>
          <Text variant="title" numberOfLines={1}>{c.name}</Text>
        </View>
      </View>

      {/* große Zählfläche: Tippen = +1 (beim Halten nur Anzeige) */}
      <Pressable disabled={phase !== 'run' || !counting} onPress={() => add(1)} accessibilityRole="adjustable"
        accessibilityLabel={tr('challenge.countAria', { n: count })}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 32, borderCurve: 'continuous',
          backgroundColor: pressed ? 'rgba(212,255,58,0.10)' : color.card })}>
        {c.kind === 'amrap' && phase === 'run'
          ? <CountdownRing size={280} stroke={12} end={runEnd} totalMs={(c.seconds ?? 60) * 1000}><BigNumber text={big} /></CountdownRing>
          : <BigNumber text={big} accent={phase === 'prep'} />}
        <Text variant="muted" style={{ fontSize: 19, marginTop: 12, fontVariant: ['tabular-nums'] }}>{sub}</Text>
        {phase === 'run' && counting && (
          <Text variant="small" style={{ position: 'absolute', bottom: 16 }}>{c.kind === 'max' ? tr('challenge.tapHintMax') : tr('challenge.tapHint')}</Text>
        )}
      </Pressable>

      {/* ganze Sätze mit einem Tipp; am Stück zählen sie nur schneller hoch */}
      {phase === 'run' && counting && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SET_SIZES.map(n => (
            <Button key={n} variant="secondary" size="lg" title={`+${n}`} label={tr('challenge.addSet', { n })} onPress={() => addSet(n)} style={{ flex: 1, paddingHorizontal: 0 }} />
          ))}
        </View>
      )}
      {phase === 'run' && parts.length > 0 && (
        <Text variant="small" style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}>{tr('challenge.sets', { list: parts.join(' · ') })}</Text>
      )}
      {phase === 'run' && (
        <ButtonRow>
          {counting && <Button size="lg" icon="undo" title="−1" label={tr('challenge.undo')} onPress={() => add(-1)} />}
          {c.kind === 'max' && <Button variant="primary" size="lg" icon={c.unit === 'seconds' ? 'stop' : 'check'}
            title={c.unit === 'seconds' ? tr('challenge.stopHold') : tr('challenge.done')} onPress={() => finish(count)} style={{ flex: 1 }} />}
          {c.kind !== 'max' && <Button size="lg" icon="check" title={tr('challenge.done')} onPress={() => finish(count)} style={{ flex: 1 }} />}
        </ButtonRow>
      )}
    </View>
  )
}

function BigNumber({ text, accent }: { text: string; accent?: boolean }) {
  return <Text style={{ fontFamily: font.displayBlack, fontSize: 120, lineHeight: 124, color: accent ? color.accent : color.text, fontVariant: ['tabular-nums'] }}>{text}</Text>
}

/** Ergebnis: Wert, neuer Bestwert oder Vergleich, Notiz, Speichern/Verwerfen */
function Result({ c, value, parts, note, setNote, onSave, onDiscard }: {
  c: Challenge; value: number; parts: number[]; note: string; setNote: (v: string) => void; onSave: () => void; onDiscard: () => void
}) {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const best = L.challengeBest(c, t.activities)
  const last = L.challengeAttempts(t.activities, c.id)[0]
  const v = L.challengeMeasuresTime(c) ? Math.round(value) : value
  const isBest = !best || L.challengeBetter(c, v, best.value!)
  // Tastatur der Notiz: Speichern bleibt darüber sichtbar, Tipp daneben schließt sie
  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: color.bg }}>
    <Pressable accessible={false} onPress={Keyboard.dismiss} style={{ flex: 1 }}>
    <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12, paddingHorizontal: GUTTER, gap: 18, justifyContent: 'space-between' }}>
      <View style={{ gap: 10 }}>
        <Text variant="eyebrow">{tr('challenge.resultTitle')} · {c.name}</Text>
        <Text style={{ fontFamily: font.displayBlack, fontSize: 96, lineHeight: 100, color: color.text, fontVariant: ['tabular-nums'] }}>{L.fmtChallengeValue(c, v)}</Text>
        {isBest && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="trophy" size={20} color={color.accent} />
            <Text variant="title" style={{ color: color.accent }}>{tr('challenge.newBest')}</Text>
          </View>
        )}
        {!isBest && best && <Text variant="muted">{tr('challenge.vsBest', { value: L.fmtChallengeValue(c, best.value!) })}</Text>}
        {last && <Text variant="muted">{tr('challenge.vsLast', { value: L.fmtChallengeValue(c, last.value!) })}</Text>}
        {parts.length > 0 && <Text variant="muted">{tr('challenge.sets', { list: parts.join(' · ') })}</Text>}
        <NoteInput label={tr('challenge.note')} value={note} onChangeText={setNote} placeholder={tr('challenge.notePlaceholder')} />
      </View>
      <View style={{ gap: 10 }}>
        <Button variant="primary" size="lg" icon="check" title={tr('challenge.save')} onPress={onSave} />
        <Button variant="ghost" title={tr('challenge.discard')} onPress={onDiscard} />
      </View>
    </Animated.View>
    </Pressable>
    </KeyboardAvoidingView>
  )
}
