/* Training im Fokus (Web: FocusView): eine Übung füllt den Screen – 3D-Clip, Kernpunkte, darunter
   das Erfassungs-Panel mit Satz-Kacheln, großem Zähler und Speichern. Oben: minimieren (auch per
   Wischen nach unten), Dauer bzw. laufende Pause, Übungsliste, Fortschritt je Übung. Wischen nach
   links/rechts wechselt die Übung. Technik, Stufe, Überspringen, Pausieren: Technik-Sheet. */
import { useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useNow } from '@lever/core/useNow.ts'
import { useHoldTimer, type HoldTimer } from '@lever/core/useHoldTimer.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, color, ExerciseMedia, font, GUTTER, Icon, radius, Ring, space, Text } from '@/ui'
import { NoteInput, SetTiles } from './parts'

const haptic = (k: 'tap' | 'success' = 'tap') => platform().signals.haptic(k)

export const minimize = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
export const openList = () => router.push({ pathname: '/exercises', params: { from: 'training' } })

/** Kopf: Minimieren, Uhr (Dauer oder Pause), Übungsliste, Fortschritt je Übung */
export function FocusTop() {
  const { t, rest, slots, focusSlot, pick, setRestView } = useApp()
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

  return (
    <GestureDetector gesture={pan}>
      <View style={{ paddingTop: insets.top + 2, paddingHorizontal: GUTTER, gap: 4 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} accessibilityElementsHidden />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Button icon="down" label={tr('training.focus.minimize')} onPress={minimize} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            {resting ? (
              <Pressable onPress={() => { haptic(); setRestView('') }} accessibilityRole="button" accessibilityLabel={tr('training.focus.openRest')}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 16, borderRadius: 999,
                  backgroundColor: rest.ringing ? color.accent : color.accentDim, borderWidth: 1, borderColor: color.accentLine, opacity: pressed ? 0.8 : 1,
                })}>
                <Icon name="timer" size={16} color={rest.ringing ? color.onAccent : color.accent} />
                <Text style={{ fontFamily: font.display, fontSize: 20, color: rest.ringing ? color.onAccent : color.accent, fontVariant: ['tabular-nums'] }}>
                  {rest.ringing ? '0:00' : L.fmtClock(rest.remaining)}
                </Text>
              </Pressable>
            ) : duration ? (
              <Text accessibilityLabel={tr('training.focus.duration', { time: duration })}
                style={{ fontFamily: font.display, fontSize: 20, color: color.text, fontVariant: ['tabular-nums'] }}>{duration}</Text>
            ) : null}
          </View>
          <Button icon="list" label={tr('training.focus.allExercises')} onPress={openList} />
        </View>
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
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, justifyContent: 'center', paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 16, gap: space.lg }}>
      <Text variant="hero" style={{ fontSize: 72, lineHeight: 68 }} accessibilityRole="header">
        {tr('training.strong')}<Text variant="hero" style={{ fontSize: 72, lineHeight: 68, color: color.accent }}>.</Text>
      </Text>
      <Text variant="muted" style={{ fontSize: 17, lineHeight: 24 }}>{tr('training.focus.allDone')}</Text>
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
              <ExerciseMedia exercise={ex} label={tr('training.focus.movement', { name: ex.name })} style={{ width: '100%', aspectRatio: 1.3 }} />

              <View style={{ gap: 8 }}>
                <Text variant="eyebrow">{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Text variant="display" style={{ flex: 1, fontSize: 36, lineHeight: 35 }} accessibilityRole="header">{ex.name}</Text>
                  <Button size="sm" icon="info" title={tr('training.focus.technique')} onPress={() => router.push({ pathname: '/exercise', params: { pid: slot.pid } })} />
                </View>
                {muscles.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessible accessibilityLabel={`${tr('training.focus.muscles')}: ${muscles.join(', ')}`}>
                    {muscles.map((m, i) => (
                      <View key={m} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: i < 2 ? color.accentDim : 'rgba(255,255,255,0.06)' }}>
                        <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: i < 2 ? color.accent : color.muted }}>{m}</Text>
                      </View>
                    ))}
                  </View>
                )}
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

/** Erfassungs-Panel unten: Satz-Kacheln, dann Zähler/Timer oder der Zustand der Übung */
function SetPanel({ slot }: { slot: L.SlotView }) {
  const { t } = useApp()
  const insets = useSafeAreaInsets()
  const ex = slot.step.exercise
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  const undo = () => slot.state === 'skipped'
    ? t.updateToday(x => L.withSkip(x, ex.id, false))
    : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))
  return (
    <View accessibilityLabel={tr('training.focus.logSet')}
      style={{
        backgroundColor: color.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous',
        paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: insets.bottom + 8, gap: 14,
        boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.45)',
      }}>
      <SetTiles slot={slot} setNo={setNo} />
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
        <SetInput key={`${slot.pid}-${setNo}`} slot={slot} setNo={setNo} />
      )}
    </View>
  )
}

/** Erfassung des nächsten Satzes – Vorbelegung wie im Satz-Sheet; Halteübungen mit Timer */
function SetInput({ slot, setNo }: { slot: L.SlotView; setNo: number }) {
  const { t, rest, pick, setRestView } = useApp()
  const ex = slot.step.exercise, target = slot.step.target
  const seconds = ex.unit === 'seconds'
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
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

  return (
    <View style={{ gap: 12 }}>
      <Text variant="small" style={{ textAlign: 'center', fontFamily: font.bodySemi }}>{caption}</Text>
      {timing ? <HoldRing hold={hold} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button icon="minus" size="lg" label={tr('training.focus.less', { n: stepBy })} onPress={() => setValue(v => Math.max(1, v - stepBy))} style={{ width: 64, height: 64 }} />
          <Text accessibilityLiveRegion="polite" accessibilityLabel={`${value}${seconds ? ' s' : ` ${tr('training.unitReps')}`}`}
            style={{ fontFamily: font.displayBlack, fontSize: 76, lineHeight: 78, color: color.text, fontVariant: ['tabular-nums'] }}>
            {value}{seconds ? <Text style={{ fontFamily: font.display, fontSize: 30, color: color.muted }}> s</Text> : null}
          </Text>
          <Button icon="plus" size="lg" label={tr('training.focus.more', { n: stepBy })} onPress={() => setValue(v => v + stepBy)} style={{ width: 64, height: 64 }} />
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
      {seconds && (timing
        ? <Button icon="close" block title={tr('training.focus.cancelTimer')} onPress={hold.cancel} />
        : <Button variant={timerFirst ? 'primary' : 'outline'} size={timerFirst ? 'lg' : 'md'} icon="timer" block
            title={hold.phase === 'done' ? tr('training.focus.again', { n: value }) : tr('training.focus.startTimer', { n: value })}
            onPress={() => hold.start(value)} />)}
      {hold.phase === 'done' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }} accessible accessibilityLiveRegion="polite">
          <Icon name="check" size={15} color={color.accent} />
          <Text variant="small" style={{ color: color.accent, fontFamily: font.bodySemi }}>{tr('training.focus.held', { n: value })}</Text>
        </View>
      )}
      {noteOpen && (
        <NoteInput label={tr('training.focus.noteSet', { set: setNo })} value={note} onChangeText={setNote} autoFocus
          placeholder={tr('training.focus.noteSetPlaceholder')} />
      )}
      <ButtonRow>
        <Button icon="note" size="lg" variant={note.trim() ? 'outline' : 'secondary'} label={tr('training.focus.noteThisSet')}
          onPress={() => setNoteOpen(o => !o)} />
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
      <Ring size={170} stroke={10} progress={hold.share} tint={prep ? color.muted : color.accent}>
        <Text style={{ fontFamily: font.displayBlack, fontSize: 64, lineHeight: 66, color: prep ? color.text : color.accent, fontVariant: ['tabular-nums'] }}>{hold.left}</Text>
        <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1 }}>
          {prep ? tr('training.focus.inPosition') : tr('training.focus.hold')}
        </Text>
      </Ring>
    </View>
  )
}
