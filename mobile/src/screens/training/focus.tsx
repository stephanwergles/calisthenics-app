/* Training im Fokus (Web: FocusView): eine Übung füllt den Screen – 3D-Clip, Kernpunkte, darunter
   das Erfassungs-Panel mit Satz-Kacheln, großem Zähler und Speichern. Oben: minimieren (auch per
   Wischen nach unten), Dauer bzw. laufende Pause, Übungsliste, Fortschritt je Übung. Wischen nach
   links/rechts wechselt die Übung. Technik, Stufe, Überspringen, Pausieren: Technik-Sheet. */
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { router, Stack } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useNow } from '@lever/core/useNow.ts'
import { useHoldTimer, type HoldTimer } from '@lever/core/useHoldTimer.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, color, CountdownRing, ExerciseMedia, font, GUTTER, Icon, radius, sf, space, Text } from '@/ui'
import { NoteInput, SetTiles } from './parts'

const haptic = (k: 'tap' | 'success' = 'tap') => platform().signals.haptic(k)
/** Höhe der nativen Navigationsleiste unter der Statusleiste (Inhalt beginnt darunter) */
const NAV_BAR = 50

export const minimize = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
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
  const restPill = resting ? (
    <Pressable onPress={() => { haptic(); setRestView('') }} accessibilityRole="button" accessibilityLabel={tr('training.focus.openRest')}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999,
        backgroundColor: rest.ringing ? color.accent : color.accentDim, borderWidth: 1, borderColor: color.accentLine, opacity: pressed ? 0.8 : 1,
      })}>
      <Icon name="timer" size={15} color={rest.ringing ? color.onAccent : color.accent} />
      <Text style={{ fontFamily: font.display, fontSize: 19, color: rest.ringing ? color.onAccent : color.accent, fontVariant: ['tabular-nums'] }}>
        {rest.ringing ? '0:00' : L.fmtClock(rest.remaining)}
      </Text>
    </Pressable>
  ) : null

  return (
    <GestureDetector gesture={pan}>
      {/* Kopf als native iOS-Toolbar (Glas): links minimieren, rechts Übungen | Stopp als Kapsel */}
      <View style={{ paddingTop: insets.top + NAV_BAR, paddingHorizontal: GUTTER, gap: 4 }}>
        {/* Pausen-Screen offen: native Toolbar ausblenden, sonst liegt sie darüber */}
        <Stack.Screen options={{ headerShown: !restShown, headerTransparent: true, headerShadowVisible: false, title: '', headerTitle: () => null, headerBackVisible: false }} />
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon={sf('down') as never} onPress={minimize} accessibilityLabel={tr('training.focus.minimize')} />
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button icon={sf('list') as never} onPress={openList} accessibilityLabel={tr('training.focus.allExercises')} />
          {t.active ? <Stack.Toolbar.Button icon={sf('stop') as never} onPress={() => void askEnd()} accessibilityLabel={tr('training.bar.stop')} /> : null}
        </Stack.Toolbar>
        {(duration || restPill) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 36 }}>
            {duration ? <Text accessibilityLabel={tr('training.focus.duration', { time: duration })}
              style={{ fontFamily: font.display, fontSize: 20, color: color.text, fontVariant: ['tabular-nums'] }}>{duration}</Text> : null}
            {restPill}
          </View>
        )}
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

/** Alles erledigt: Training beenden oder zurück zur Übersicht */
export function AllDone() {
  const { t, finish } = useApp()
  const insets = useSafeAreaInsets()
  // Runden-Blöcke kommen nach den Leiter-Übungen: offene zuerst anbieten
  const circuits = L.circuitsOf(t.ix.workouts.get(t.workout))
  const open = circuits.filter(c => !L.circuitResultOf(t.todaySession, c.id))
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 16, gap: space.lg }}>
      <Text variant="hero" style={{ fontSize: 72, lineHeight: 68 }} accessibilityRole="header">
        {open.length ? tr('training.focus.roundsNow') : tr('training.strong')}<Text variant="hero" style={{ fontSize: 72, lineHeight: 68, color: color.accent }}>.</Text>
      </Text>
      {open.length
        ? open.map(c => <CircuitCard key={c.id} id={c.id} />)
        : <Text variant="muted" style={{ fontSize: 17, lineHeight: 24 }}>{tr('training.focus.allDone')}</Text>}
      <View style={{ gap: 10, marginTop: space.md }}>
        {t.active && <Button variant="primary" size="lg" icon="check" title={tr('training.focus.finish')} onPress={finish} />}
        <Button variant={t.active ? 'secondary' : 'primary'} size={t.active ? 'md' : 'lg'} icon="list" title={tr('training.focus.allExercises')} onPress={openList} />
      </View>
    </Animated.View>
  )
}

/** Übung im Fokus: Inhalt (scrollend, seitlich wischbar) und Erfassungs-Panel */
export function FocusExercise({ slot, index, total }: { slot: L.SlotView; index: number; total: number }) {
  const { t, slots, pick } = useApp()
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg }}>
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
      <SetPanel slot={slot} />
    </KeyboardAvoidingView>
  )
}

/** Erfassung als Sheet mit zwei Zuständen: Satz-Kacheln, Zähler und Aktionen immer sichtbar; hochgezogen
    (Griff ziehen oder antippen, Notiz-Knopf) zusätzlich die Werte vom letzten Mal und die Satz-Notiz.
    Der Zusatzbereich folgt beim Ziehen dem Finger und rastet beim Loslassen ein. */
function SetPanel({ slot }: { slot: L.SlotView }) {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const ex = slot.step.exercise
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  // ohne offenen Satz (erledigt, übersprungen, pausiert) gibt es nichts einzuklappen
  const fixed = setNo === null
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { setNote('') }, [setNo, slot.pid])
  const last = slot.last?.sets.length ? slot.last.sets.slice().sort((a, b) => a.set - b.set).map(x => L.fmtSet(x, ex)).join(' · ') : null
  const [full, setFull] = useState(0)
  const open = useSharedValue(0)
  const startOpen = useSharedValue(0)
  const shown = !fixed && expanded
  useEffect(() => { open.set(withSpring(shown ? 1 : 0, { damping: 22, stiffness: 240 })) }, [shown, open])
  const moreStyle = useAnimatedStyle(() => ({ height: full * open.get(), opacity: Math.min(1, open.get() * 1.6) }))
  const toggle = (on?: boolean) => { if (fixed) return; haptic(); setExpanded(x => on ?? !x) }
  const drag = usePanGesture({
    activeOffsetY: [-6, 6], runOnJS: true, enabled: !fixed && full > 0,
    onActivate: () => { startOpen.set(open.get()) },
    onUpdate: e => { open.set(Math.max(0, Math.min(1, startOpen.get() - e.translationY / full))) },
    onDeactivate: e => {
      const next = e.velocityY < -350 ? true : e.velocityY > 350 ? false : open.get() > 0.5
      if (next === expanded) open.set(withSpring(next ? 1 : 0, { damping: 22, stiffness: 240 }))
      else toggle(next)
    },
  })
  const undo = () => slot.state === 'skipped'
    ? t.updateToday(x => L.withSkip(x, ex.id, false))
    : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))
  const onMore = (e: LayoutChangeEvent) => { const h = e.nativeEvent.layout.height; if (h && Math.abs(h - full) > 1) setFull(h) }

  return (
    <View accessibilityLabel={tr('training.focus.logSet')}
      style={{
        backgroundColor: color.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous',
        paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 8, gap: 12,
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.45)',
      }}>
      <GestureDetector gesture={drag}>
        <View>
          {/* Griff: ziehen oder antippen */}
          <Pressable onPress={() => toggle()} disabled={fixed} accessibilityRole="button" accessibilityState={{ expanded: shown }}
            accessibilityLabel={shown ? tr('training.focus.collapse') : tr('training.focus.expand')}
            style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}>
            {!fixed && <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />}
          </Pressable>
          <SetTiles slot={slot} setNo={setNo} />
          <Animated.View style={[{ overflow: 'hidden' }, moreStyle]} accessibilityElementsHidden={!shown} importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}>
            {/* gemessen in voller Höhe, sichtbar je nach Aufzug */}
            <View onLayout={onMore} style={{ position: 'absolute', left: 0, right: 0, gap: 10, paddingTop: 12 }}>
              {last && <Text variant="small">{tr('training.focus.lastTime', { sets: last })}</Text>}
              {setNo !== null && (
                <NoteInput label={tr('training.focus.noteSet', { set: setNo })} value={note} onChangeText={setNote}
                  placeholder={tr('training.focus.noteSetPlaceholder')} />
              )}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
      {slot.state === 'skipped' || slot.state === 'paused' ? (
        <View style={{ gap: 10, paddingBottom: 6 }}>
          <Text variant="muted">{slot.state === 'skipped' ? tr('training.skippedToday') : tr('training.pausedUntil')}</Text>
          <Button icon="undo" block title={slot.state === 'skipped' ? tr('training.undoSkip') : tr('training.resume')} onPress={undo} />
        </View>
      ) : setNo === null ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10 }} accessible>
          <Icon name="checkCircle" size={20} color={color.chalk} />
          <Text variant="label" style={{ flex: 1 }}>{tn('training.focus.allLogged', slot.planned, { sets: slot.sets.map(x => L.fmtSet(x, ex)).join(' · ') })}</Text>
        </View>
      ) : (
        <SetInput key={`${slot.pid}-${setNo}`} slot={slot} setNo={setNo} note={note} onNote={() => toggle()} />
      )}
    </View>
  )
}

/** Erfassung des nächsten Satzes – Vorbelegung wie im Satz-Sheet; Halteübungen mit Timer */
function SetInput({ slot, setNo, note, onNote }: { slot: L.SlotView; setNo: number; note: string; onNote: () => void }) {
  const { t, rest, pick, setRestView } = useApp()
  const ex = slot.step.exercise, target = slot.step.target
  const seconds = ex.unit === 'seconds'
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const stepBy = seconds ? 5 : 1
  // Halteübungen: Timer mit Vorlauf; bis er durch ist, ist „Timer starten“ die Hauptaktion
  const hold = useHoldTimer()
  const timing = hold.phase === 'prep' || hold.phase === 'hold'
  const timerFirst = seconds && hold.phase !== 'done'

  const save = () => {
    const n = L.cleanNote(note)
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}), ...(n ? { note: n } : {}) }))
    t.startSession()
    haptic('success')
    rest.start(target.restSec)
    // Rückmeldung für den Pausen-Screen: Wert und Vergleich zum gleichen Satz beim letzten Mal
    const before = slot.last?.sets.find(x => x.set === setNo)
    const d = before ? value - before.value : null
    const unit = seconds ? 's' : tr('training.unitReps')
    const summary = `${value}${weight ? ` +${weight} kg` : ''} ${unit}${d === null ? '' : d === 0 ? tr('training.focus.sameAsLast') : tr('training.focus.vsLast', { d: `${d > 0 ? '+' : '−'}${Math.abs(d)}` })}`
    // letzter geplanter Satz → nach der Pause geht es mit der nächsten offenen Übung weiter
    if (L.nextSetNo({ sets: [...slot.sets, { exercise: ex.id, progression: slot.pid, set: setNo, value: 0 }], planned: slot.planned }) === null) pick(undefined)
    if (target.restSec > 0) setRestView(summary)
  }

  const lastSet = slot.last?.sets.find(x => x.set === setNo)
  const caption = `${tr('training.focus.caption', { set: setNo, planned: slot.planned, target: target.label })}${lastSet ? tr('training.focus.captionLast', { value: `${lastSet.value}${seconds ? ' s' : ''}${lastSet.weightKg ? ` +${L.fmtNum(lastSet.weightKg)} kg` : ''}` }) : ''}`

  // kompakt, damit die Übung darüber sichtbar bleibt: Satz-Zeile mit Notiz-Knopf, kleiner Zähler,
  // Aktionen in einer Reihe (Halteübungen: Timer + Speichern nebeneinander)
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="small" numberOfLines={1} style={{ flex: 1, fontFamily: font.bodySemi }}>{caption}</Text>
        <Button icon="note" size="sm" variant={note.trim() ? 'outline' : 'ghost'} label={tr('training.focus.noteThisSet')} onPress={onNote} />
      </View>
      {timing ? <HoldRing hold={hold} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button icon="minus" label={tr('training.focus.less', { n: stepBy })} onPress={() => setValue(v => Math.max(1, v - stepBy))} style={{ width: 52, height: 52 }} />
          <Text accessibilityLiveRegion="polite" accessibilityLabel={`${value}${seconds ? ' s' : ` ${tr('training.unitReps')}`}`}
            style={{ fontFamily: font.displayBlack, fontSize: 56, lineHeight: 58, color: color.text, fontVariant: ['tabular-nums'] }}>
            {value}{seconds ? <Text style={{ fontFamily: font.display, fontSize: 24, color: color.muted }}> s</Text> : null}
          </Text>
          <Button icon="plus" label={tr('training.focus.more', { n: stepBy })} onPress={() => setValue(v => v + stepBy)} style={{ width: 52, height: 52 }} />
        </View>
      )}
      {ex.weighted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text variant="small" style={{ flex: 1, fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 0.6 }}>{tr('training.focus.weight')}</Text>
          <Button icon="minus" label={tr('training.focus.weightLess')} onPress={() => setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))} />
          <Text style={{ minWidth: 70, textAlign: 'center', fontFamily: font.display, fontSize: 24, color: color.text, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`${tr('training.focus.weight')}: ${L.fmtNum(weight)} kg`}>
            {L.fmtNum(weight)}<Text style={{ fontFamily: font.displaySemi, fontSize: 15, color: color.muted }}> kg</Text>
          </Text>
          <Button icon="plus" label={tr('training.focus.weightMore')} onPress={() => setWeight(w => +(w + 2.5).toFixed(1))} />
        </View>
      )}
      {hold.phase === 'done' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} accessible accessibilityLiveRegion="polite">
          <Icon name="check" size={15} color={color.accent} />
          <Text variant="small" style={{ color: color.accent, fontFamily: font.bodySemi }}>{tr('training.focus.held', { n: value })}</Text>
        </View>
      )}
      <ButtonRow>
        {seconds && (timing
          ? <Button size="lg" icon="close" title={tr('training.focus.cancelTimer')} onPress={hold.cancel} style={{ flex: 1 }} />
          : <Button variant={timerFirst ? 'primary' : 'outline'} size="lg" icon="timer" style={{ flex: 1 }}
              title={hold.phase === 'done' ? tr('training.focus.againShort') : tr('training.focus.timerShort')}
              onPress={() => hold.start(value)} />)}
        <Button variant={timerFirst ? 'secondary' : 'primary'} size="lg" icon="check" title={tr('training.focus.saveSet')} onPress={save} style={{ flex: 1 }} />
      </ButtonRow>
    </View>
  )
}

/** Großer Ring während des Halte-Timers: erst Vorlauf zum Positionieren, dann Halten */
function HoldRing({ hold }: { hold: HoldTimer }) {
  const prep = hold.phase === 'prep'
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityRole="timer"
      accessibilityLabel={`${hold.left} s, ${prep ? tr('training.focus.inPosition') : tr('training.focus.hold')}`}>
      <CountdownRing size={170} stroke={10} end={hold.end} totalMs={hold.spanMs} tint={prep ? color.muted : color.accent}>
        <Text style={{ fontFamily: font.displayBlack, fontSize: 64, lineHeight: 66, color: prep ? color.text : color.accent, fontVariant: ['tabular-nums'] }}>{hold.left}</Text>
        <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1 }}>
          {prep ? tr('training.focus.inPosition') : tr('training.focus.hold')}
        </Text>
      </CountdownRing>
    </View>
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
        <Text variant="small">{L.fmtCircuitItems(t.ix, c)}</Text>
        {done ? <Text variant="label" style={{ color: color.accent }}>{L.fmtCircuitResult(c, done)}</Text>
          : last ? <Text variant="small">{tr('circuit.last', { value: L.fmtCircuitResult(c, last.r) })}</Text> : null}
      </View>
      {!done && <Button variant="primary" icon="play" title={tr('circuit.start')} onPress={go} />}
    </View>
  )
}
