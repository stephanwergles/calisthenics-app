/* Runden-Block durchführen (Vollbild, z. B. Cindy): 3-2-1-Vorlauf, dann
   – AMRAP: Countdown-Ring, „Runde geschafft“ zählt Runden; am Ende die Wiederholungen der
     angefangenen Runde eintragen
   – feste Runden: Stoppuhr, endet mit der letzten Runde
   Die Übungen der Runde stehen immer sichtbar darunter. Ergebnis landet in der heutigen Einheit
   (zählt als Training, nicht für die Leiter-Freischaltung). Params: cid (Block im heutigen Workout). */
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { platform } from '@lever/core/platform.ts'
import { toast } from '@lever/core/toast.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import type { Circuit, CircuitResult } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { ask, Button, ButtonRow, color, CountdownRing, ExerciseStill, font, GUTTER, Icon, radius, Stepper, Text } from '@/ui'
import { useChallengeActivity } from '@/live/use-challenge-activity'

const PREP = 3
type Phase = 'prep' | 'run' | 'result'
const signals = () => platform().signals

export default function CircuitRunRoute() {
  const { t } = useApp()
  const { cid } = useLocalSearchParams<{ cid: string }>()
  const c = L.circuitsOf(t.ix.workouts.get(t.workout)).find(x => x.id === cid)
  if (!c) return null
  return <Run c={c} />
}

function Run({ c }: { c: Circuit }) {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const [phase, setPhase] = useState<Phase>('prep')
  const [now, setNow] = useState(Date.now())
  const [prepEnd] = useState(() => Date.now() + PREP * 1000)
  const [start, setStart] = useState(0)
  const [rounds, setRounds] = useState(0)
  const [reps, setReps] = useState(0)
  const [time, setTime] = useState(0)
  const amrap = c.mode === 'amrap'
  const end = amrap && start ? start + (c.minutes ?? 10) * 60_000 : null
  const target = c.rounds ?? 0
  // Sperrbildschirm/Dynamic Island: gleiche Activity wie bei Challenges
  useChallengeActivity({ id: c.id, name: L.fmtCircuitRule(c), kind: amrap ? 'amrap' : 'fortime', unit: 'reps', seconds: (c.minutes ?? 10) * 60, target },
    phase === 'run' ? start : null, rounds, amrap ? tn('logic.circuit.roundsN', rounds) : `${tr('circuit.round')} ${Math.min(rounds + 1, target)} / ${target}`)

  useEffect(() => { signals().prime(); void signals().keepAwake(true); return () => { void signals().keepAwake(false) } }, [])
  useEffect(() => {
    if (phase === 'result') return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'prep' && now >= prepEnd) { setStart(Date.now()); signals().haptic('success'); setPhase('run') }
    if (phase === 'run' && end && now >= end) finish()
  }, [now]) // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = start ? (now - start) / 1000 : 0
  const finish = () => {
    if (phase !== 'run') return
    signals().alarm(); signals().haptic('warning')
    setTime(Math.round((Date.now() - start) / 1000))
    setPhase('result')
  }
  const roundDone = () => {
    if (phase !== 'run') return
    const next = rounds + 1
    signals().haptic('success'); setRounds(next)
    if (!amrap && next >= target) finish()
  }
  const undo = () => { if (phase === 'run' && rounds > 0) { signals().haptic('tap'); setRounds(rounds - 1) } }
  const close = async () => {
    if (phase === 'result' || await ask({ title: tr('circuit.cancelTitle'), message: tr('circuit.cancelMessage'), ok: tr('circuit.cancelOk'), cancel: tr('challenge.keepGoing'), destructive: true })) router.back()
  }

  if (phase === 'result') {
    const r: CircuitResult = amrap ? { id: c.id, rounds, ...(reps ? { reps } : {}) } : { id: c.id, rounds, durationSec: time }
    const last = L.lastCircuitResult(t.sessions, c.id, t.today)
    // angefangene Runde: höchstens alle Wiederholungen einer Runde minus eine
    const perRound = c.items.reduce((n, x) => n + x.reps, 0)
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 12, paddingHorizontal: GUTTER, gap: 18, justifyContent: 'space-between' }}>
        <View style={{ gap: 10 }}>
          <Text variant="eyebrow">{tr('circuit.result')} · {L.fmtCircuitRule(c)}</Text>
          <Text style={{ fontFamily: font.displayBlack, fontSize: 72, lineHeight: 76, color: color.text, fontVariant: ['tabular-nums'] }}>{L.fmtCircuitResult(c, r)}</Text>
          {last && (L.circuitBetter(c, r, last.r)
            ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trophy" size={20} color={color.accent} /><Text variant="title" style={{ color: color.accent }}>{tr('circuit.better')}</Text></View>
            : <Text variant="muted">{tr('circuit.last', { value: L.fmtCircuitResult(c, last.r) })}</Text>)}
          {amrap && <Stepper label={tr('circuit.extraReps')} value={String(reps)}
            onMinus={() => setReps(Math.max(0, reps - 1))} onPlus={() => setReps(Math.min(perRound - 1, reps + 1))} />}
        </View>
        <View style={{ gap: 10 }}>
          <Button variant="primary" size="lg" icon="check" title={tr('circuit.save')} onPress={() => {
            t.updateToday(s => L.withCircuitResult(s, r))
            toast(tr('circuit.saved'), 'success'); router.back()
          }} />
          <Button variant="ghost" title={tr('challenge.discard')} onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const big = phase === 'prep' ? String(Math.max(1, Math.ceil((prepEnd - now) / 1000))) : String(rounds)
  const sub = phase === 'prep' ? tr('challenge.getReady')
    : amrap ? L.fmtClock(Math.max(0, Math.ceil(((end ?? 0) - now) / 1000)))
    : `${L.fmtClock(Math.floor(elapsed))} · ${tr('circuit.roundOf', { n: Math.min(rounds + 1, target), total: target })}`
  const body = <Text style={{ fontFamily: font.displayBlack, fontSize: 120, lineHeight: 124, color: phase === 'prep' ? color.accent : color.text, fontVariant: ['tabular-nums'] }}>{big}</Text>

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: GUTTER, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Button icon="close" label={tr('circuit.cancel')} onPress={() => void close()} />
        <View style={{ flex: 1 }}>
          <Text variant="eyebrow" numberOfLines={1}>{tr('circuit.section')}</Text>
          <Text variant="title" numberOfLines={1}>{L.fmtCircuitRule(c)}</Text>
        </View>
      </View>

      {/* große Fläche: Tipp = Runde geschafft (wie der Zähler bei Challenges) */}
      <Pressable disabled={phase !== 'run'} onPress={roundDone} accessibilityRole="button" accessibilityLabel={tr('circuit.roundDone')}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 32, borderCurve: 'continuous',
          backgroundColor: pressed ? 'rgba(212,255,58,0.10)' : color.card, gap: 6 })}>
        {amrap && phase === 'run' ? <CountdownRing size={250} stroke={12} end={end} totalMs={(c.minutes ?? 10) * 60_000}>{body}</CountdownRing> : body}
        <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{phase === 'prep' ? '' : tn('circuit.roundsDone', rounds)}</Text>
        <Text variant="muted" style={{ fontSize: 19, fontVariant: ['tabular-nums'] }}>{sub}</Text>
        {phase === 'run' && <Text variant="small" style={{ position: 'absolute', bottom: 16 }}>{tr('circuit.tapHint')}</Text>}
      </Pressable>

      {/* die Runde: immer sichtbar */}
      <View accessible accessibilityLabel={`${tr('circuit.perRound')}: ${L.fmtCircuitItems(t.ix, c)}`}
        style={{ backgroundColor: color.card, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, paddingVertical: 8 }}>
        {c.items.map((x, i) => {
          const e = t.ix.exercises.get(x.exercise)
          return (
            <View key={`${x.exercise}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 6 }}>
              {e ? <ExerciseStill exercise={e} size={16} style={{ width: 40, height: 40, borderRadius: radius.lg, borderCurve: 'continuous' }} /> : null}
              <Text variant="num" style={{ fontSize: 26, minWidth: 44, color: color.accent }}>{e?.unit === 'seconds' ? `${x.reps}s` : x.reps}</Text>
              <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{e?.name ?? x.exercise}</Text>
            </View>
          )
        })}
      </View>

      {phase === 'run' && (
        <ButtonRow>
          <Button size="lg" icon="undo" title="−1" label={tr('circuit.undo')} onPress={undo} />
          <Button variant="primary" size="lg" icon="check" title={tr('circuit.roundDone')} onPress={roundDone} style={{ flex: 1 }} />
          {amrap && <Button size="lg" icon="stop" label={tr('circuit.stop')} onPress={finish} />}
        </ButtonRow>
      )}
    </View>
  )
}
