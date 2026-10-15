/* Training im Fokus (Web: FocusView): eine Übung füllt den Screen – 3D-Clip, Kernpunkte, darunter
   das Erfassungs-Panel mit Satz-Kacheln, großem Zähler und Speichern. Oben: minimieren (auch per
   Wischen nach unten), Dauer bzw. laufende Pause, Übungsliste, Fortschritt je Übung. Wischen nach
   links/rechts wechselt die Übung. Technik, Stufe, Überspringen, Pausieren: Technik-Sheet. */
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { router, Stack } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useNow } from '@lever/core/useNow.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, ExerciseMedia, ExerciseStill, font, GUTTER, Icon, radius, sf, space, Text } from '@/ui'
import { setSheet, useSetSheet } from '@/state/set-sheet'

const haptic = (k: 'tap' | 'success' = 'tap') => platform().signals.haptic(k)
/** Höhe der nativen Navigationsleiste unter der Statusleiste (Inhalt beginnt darunter) */
const NAV_BAR = 50

// mit offenem Erfassungs-Sheet beides schließen (Sheet und Training)
export const minimize = () => { if (setSheet.get().open) router.dismiss(2); else if (router.canGoBack()) router.back(); else router.replace('/') }
export const openList = () => router.push({ pathname: '/exercises', params: { from: 'training' } })

/** Kopf: Minimieren, Uhr (Dauer oder Pause), Übungsliste, Fortschritt je Übung */
export function FocusTop() {
  const { t, rest, restView, slots, focusSlot, pick, setRestView, askEnd } = useApp()
  const now = useNow(!!t.active)
  const insets = useSafeAreaInsets()
  const resting = rest.running || rest.ringing
  const index = focusSlot ? slots.findIndex(s => s.pid === focusSlot.pid) : -1
  const go = (by: 1 | -1) => { const n = slots[index + by]; if (n) { haptic(); pick(n.pid) } }
  // nach unten wischen = minimieren (Session läuft im Mini-Player weiter)
  const pan = usePanGesture({
    activeOffsetY: 24, failOffsetX: [-24, 24], runOnJS: true,
    onDeactivate: e => { if (e.translationY > 70 || e.velocityY > 700) minimize() },
  })
  const duration = t.active ? L.fmtDuration(Math.max(0, now - t.active.start) / 1000) : ''

  // Uhr unter der Toolbar (nicht als nativer Titel – der wurde nicht zuverlässig neu gezeichnet):
  // Trainingsdauer immer sichtbar, laufende Pause daneben (antippen öffnet den Pausen-Screen)
  const restShown = restView !== null && resting
  // laufende Pause als eigener nativer Toolbar-Knopf (Glas): antippbar – die Toolbar liegt über
  // dem Inhalt und nimmt sonst jeden Tipp in ihrer Zeile ab
  const restLabel = rest.ringing ? '0:00' : L.fmtClock(rest.remaining)

  return (
    <GestureDetector gesture={pan}>
      {/* Kopf als native iOS-Toolbar (Glas): links minimieren, rechts Übungen | Stopp als Kapsel */}
      <View style={{ paddingTop: insets.top + NAV_BAR, paddingHorizontal: GUTTER, gap: 4 }}>
        {/* Pausen-Screen offen: native Toolbar ausblenden, sonst liegt sie darüber */}
        <Stack.Screen options={{ headerShown: !restShown }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon={sf('down') as never} onPress={minimize} accessibilityLabel={tr('training.focus.minimize')} />
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          {resting && !restShown ? (
            // nur Text: mit Symbol zeigt iOS den Titel nicht an
            <Stack.Toolbar.Button onPress={() => { haptic(); setRestView('') }} separateBackground
              tintColor={color.accent} accessibilityLabel={tr('training.focus.openRest')} style={{ fontFamily: font.display, fontSize: 18 }}>
              {restLabel}
            </Stack.Toolbar.Button>
          ) : null}
          <Stack.Toolbar.Button icon={sf('list') as never} onPress={openList} accessibilityLabel={tr('training.focus.allExercises')} />
          {t.active ? <Stack.Toolbar.Button icon={sf('stop') as never} onPress={() => void askEnd()} accessibilityLabel={tr('training.bar.stop')} /> : null}
        </Stack.Toolbar>
        {/* Uhr in der Zeile der Toolbar-Knöpfe (zwischen Minimieren und Übungen | Stopp), über der
            nativen Leiste gezeichnet; box-none lässt Tipps neben der Uhr zu den Knöpfen durch */}
        {/* Trainingsdauer in der Zeile der Toolbar-Knöpfe; während der Pause links neben Minimieren,
            weil rechts die Pause steht */}
        {duration ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top, left: resting ? 76 : 0, right: resting ? undefined : 0, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: resting ? 'flex-start' : 'center', zIndex: 10 }}>
            <Text accessibilityLabel={tr('training.focus.duration', { time: duration })}
              style={{ fontFamily: font.display, fontSize: resting ? 18 : 20, color: resting ? color.muted : color.text, fontVariant: ['tabular-nums'] }}>{duration}</Text>
          </View>
        ) : null}
        {/* Fortschritt je Übung – antippbar; VoiceOver: wischen hoch/runter wechselt die Übung */}
        <View accessible accessibilityRole="adjustable" accessibilityLabel={tr('training.focus.exercises')}
          accessibilityValue={{ text: focusSlot ? tr('training.focus.position', { i: index + 1, n: slots.length, name: focusSlot.step.exercise.name }) : tr('training.strong') }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => go(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ flexDirection: 'row', gap: 4 }}>
          {slots.map(s => {
            const cur = s.pid === focusSlot?.pid
            return (
              <Pressable key={s.pid} onPress={() => { haptic(); pick(s.pid) }} hitSlop={{ top: 6, bottom: 6 }}
                style={{ flex: 1, height: 30, justifyContent: 'center' }}>
                <View style={{
                  height: cur ? 6 : 4, borderRadius: 3,
                  backgroundColor: cur ? color.accent : s.state === 'done' ? color.chalk : s.state === 'open' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                }} />
              </Pressable>
            )
          })}
        </View>
      </View>
    </GestureDetector>
  )
}

/** Alles erledigt: Training beenden (oder verwerfen) oder zurück zur Übersicht */
export function AllDone() {
  const { t, finish, askDiscard } = useApp()
  const insets = useSafeAreaInsets()
  // Runden-Blöcke kommen nach den Leiter-Übungen: offene zuerst anbieten
  const circuits = L.circuitsOf(t.ix.workouts.get(t.workout))
  const open = circuits.filter(c => !L.circuitResultOf(t.todaySession, c.id))
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 16, gap: space.lg }}>
      <Text variant="hero" style={{ fontSize: 72, lineHeight: 68 }} accessibilityRole="header">
        {open.length ? t.ix.workouts.get(t.workout)?.name ?? tr('circuit.section') : tr('training.strong')}<Text variant="hero" style={{ fontSize: 72, lineHeight: 68, color: color.accent }}>.</Text>
      </Text>
      {open.length
        ? open.map(c => <CircuitCard key={c.id} id={c.id} />)
        : <Text variant="muted" style={{ fontSize: 17, lineHeight: 24 }}>{tr('training.focus.allDone')}</Text>}
      <View style={{ gap: 10, marginTop: space.md }}>
        {/* offene Runden sind die Hauptaktion – Beenden dann nur als Nebenaktion */}
        {t.active && <Button variant={open.length ? 'ghost' : 'primary'} size={open.length ? 'md' : 'lg'} icon="check" title={tr('training.focus.finish')} onPress={finish} />}
        {!open.length && <Button variant={t.active ? 'secondary' : 'primary'} size={t.active ? 'md' : 'lg'} icon="list" title={tr('training.focus.allExercises')} onPress={openList} />}
        {t.active && <Button variant="ghost" icon="trash" title={tr('training.focus.discard')} onPress={() => void askDiscard()} />}
      </View>
    </Animated.View>
  )
}

/** Übung im Fokus: Inhalt (scrollend, seitlich wischbar) und Erfassungs-Panel */
export function FocusExercise({ slot, index, total }: { slot: L.SlotView; index: number; total: number }) {
  const { t, slots, pick } = useApp()
  // Platz für das native Erfassungs-Sheet (app/log-set.tsx) unter dem Inhalt
  const sheetHeight = useSetSheet().height
  const { step } = slot, ex = step.exercise
  const muscles = ex.muscles ?? []
  const lastNotes = slot.last ? L.notesOf(slot.last.sets) : []
  const go = (by: 1 | -1) => { const n = slots[index + by]; if (n) { haptic(); pick(n.pid) } }
  const swipe = usePanGesture({
    activeOffsetX: [-24, 24], failOffsetY: [-14, 14], runOnJS: true,
    onDeactivate: e => {
      if (e.translationX < -60 || e.velocityX < -600) go(1)
      else if (e.translationX > 60 || e.velocityX > 600) go(-1)
    },
  })
  const label = `${L.BLOCK_LABEL[slot.block]} · ${index + 1}/${total}${step.total > 1 ? ` · ${tr('logic.stage', { i: step.index + 1, n: step.total })}` : ''}`

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: sheetHeight + space.xl, gap: space.lg }}>
            <Animated.View entering={FadeIn.duration(180)} style={{ gap: space.lg }}>
              {/* Bild mit allem, was zur Übung gehört: Einordnung und Technik oben, Name und Muskeln unten
                  über einem Verlauf – so bleibt es auch über dem Erfassungs-Sheet sichtbar */}
              <View style={{ width: '100%', aspectRatio: 1, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.card }}>
                <ExerciseMedia exercise={ex} label={tr('training.focus.movement', { name: ex.name })} style={{ width: '100%', height: '100%', borderRadius: 0 }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}>
                  <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
                    <Defs>
                      <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={color.bg} stopOpacity="0" />
                        <Stop offset="0.55" stopColor={color.bg} stopOpacity="0.7" />
                        <Stop offset="1" stopColor={color.bg} stopOpacity="0.95" />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#fade)" />
                  </Svg>
                </View>
                <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(16,16,16,0.72)' }}>
                    <Text variant="eyebrow" style={{ fontSize: 12 }}>{label}</Text>
                  </View>
                  <Button size="sm" icon="info" title={tr('training.focus.technique')} onPress={() => router.push({ pathname: '/exercise', params: { pid: slot.pid } })} />
                </View>
                <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 14, gap: 8 }}>
                  <Text variant="display" style={{ fontSize: 34, lineHeight: 33 }} accessibilityRole="header">{ex.name}</Text>
                  {muscles.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessible accessibilityLabel={`${tr('training.focus.muscles')}: ${muscles.join(', ')}`}>
                      {muscles.map((m, i) => (
                        <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: i < 2 ? 'rgba(212,255,58,0.16)' : 'rgba(255,255,255,0.10)' }}>
                          <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: i < 2 ? color.accent : color.text }}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {ex.cues?.length ? (
                <View style={{ gap: 10 }} accessibilityLabel={tr('training.focus.cues')}>
                  {ex.cues.map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: font.display, fontSize: 15, color: color.accent }}>{i + 1}</Text>
                      </View>
                      <Text variant="body" style={{ flex: 1, paddingTop: 2 }}>{c}</Text>
                    </View>
                  ))}
                </View>
              ) : <Text variant="body">{ex.technique.execution}</Text>}

              {lastNotes.map(n => (
                <View key={n.set} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: color.card }}>
                  <Icon name="note" size={16} color={color.muted} />
                  <Text variant="muted" style={{ flex: 1 }}>{tr('training.focus.lastNote', { set: n.set, note: n.note })}</Text>
                </View>
              ))}

              {slot.ready && step.next && (
                <Button variant="outline" icon="up" block title={tr('training.focus.readyFor', { name: step.next.name })}
                  onPress={() => t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: step.next!.id } }))} />
              )}
            </Animated.View>
          </ScrollView>
        </View>
      </GestureDetector>
    </KeyboardAvoidingView>
  )
}

/** Runden-Block im Training: Regel, Übungen, letztes Ergebnis; „Starten“ öffnet den Runden-Timer
    (startet die Einheit mit, falls sie noch nicht läuft) */
export function CircuitCard({ id }: { id: string }) {
  const { t } = useApp()
  const c = L.circuitsOf(t.ix.workouts.get(t.workout)).find(x => x.id === id)
  if (!c) return null
  const done = L.circuitResultOf(t.todaySession, c.id)
  const last = L.lastCircuitResult(t.sessions, c.id, t.today)
  const go = () => { if (!t.active) t.startSession(t.workout); router.push({ pathname: '/circuit-run', params: { cid: c.id } }) }
  return (
    <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: done ? color.line : color.accentLine, padding: 16, gap: 10 }}>
      <View style={{ gap: 3 }}>
        <Text variant="eyebrow" style={{ fontSize: 11 }}>{tr('circuit.section')}</Text>
        <Text variant="title" style={{ fontSize: 22 }}>{L.fmtCircuitRule(c)}</Text>
        {done ? <Text variant="label" style={{ color: color.accent }}>{L.fmtCircuitResult(c, done)}</Text>
          : last ? <Text variant="small">{tr('circuit.last', { value: L.fmtCircuitResult(c, last.r) })}</Text> : null}
      </View>
      {/* die Runde: jede Übung mit Bild und Zahl */}
      <View style={{ gap: 8 }} accessibilityLabel={`${tr('circuit.perRound')}: ${L.fmtCircuitItems(t.ix, c)}`}>
        {c.items.map((x, i) => {
          const e = t.ix.exercises.get(x.exercise)
          return (
            <View key={`${x.exercise}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {e ? <ExerciseStill exercise={e} size={18} style={{ width: 48, height: 48, borderRadius: radius.lg, borderCurve: 'continuous' }} /> : null}
              <Text variant="num" style={{ fontSize: 24, minWidth: 44, color: color.accent }}>{e?.unit === 'seconds' ? `${x.reps}s` : x.reps}</Text>
              <Text variant="label" style={{ flex: 1 }} numberOfLines={2}>{e?.name ?? x.exercise}</Text>
            </View>
          )
        })}
      </View>
      {!done && <Button variant="primary" icon="play" title={tr('circuit.start')} onPress={go} />}
    </View>
  )
}
