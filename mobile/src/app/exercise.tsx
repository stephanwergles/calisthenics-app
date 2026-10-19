/* Technik & Optionen einer Übung (Web: ExerciseSheet/exerciseSheetSpec) – Param pid.
   Bewegung (3D-Clip/Skizze), voller Technik-Text, Tutorial, Stufe wechseln, heute überspringen, dauerhaft pausieren. */
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, color, ExerciseMedia, font, radius, Text } from '@/ui'
import { FormSheet } from '@/screens/training/parts'

export default function ExerciseRoute() {
  const { pid } = useLocalSearchParams<{ pid: string }>()
  const { t, slots } = useApp()
  const slot = slots.find(s => s.pid === pid)
  if (!slot) return <FormSheet title={tr('training.focus.technique')} />
  const { step } = slot, ex = step.exercise
  const done = (fn: () => void) => () => { fn(); router.back() }
  const setStep = (id: string) => t.setState(st => ({ ...st, current: { ...st.current, [slot.pid]: id } }))
  const sub = `${L.BLOCK_LABEL[slot.block]}${step.total > 1 ? ` · ${tr('logic.stage', { i: step.index + 1, n: step.total })}` : ''}${tr('sheets.target', { target: step.target.label })}`
  const sections = [
    { title: tr('sheets.exercise.setup'), text: ex.technique.setup },
    { title: tr('sheets.exercise.execution'), text: ex.technique.execution },
    { title: tr('sheets.exercise.faults'), text: ex.technique.faults, warn: true },
    ...(ex.technique.scaling ? [{ title: tr('sheets.exercise.scaling'), text: ex.technique.scaling }] : []),
  ]
  const video = ex.media.videoQuery
  return (
    <FormSheet title={ex.name} sub={sub}>
      {/* Bewegung zuerst: 3D-Clip bzw. Skizze, wie im Training */}
      <View style={{ width: '100%', aspectRatio: 1.25, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: color.card }}>
        <ExerciseMedia exercise={ex} label={tr('training.focus.movement', { name: ex.name })} style={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </View>
      {sections.map(s => (
        <View key={s.title} style={{ gap: 4 }}>
          <Text variant="small" accessibilityRole="header"
            style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 0.8, color: s.warn ? color.danger : color.muted }}>{s.title}</Text>
          <Text variant="body" selectable>{s.text}</Text>
        </View>
      ))}
      {video && (
        <Button icon="video" block title={tr('sheets.exercise.video')}
          onPress={() => void WebBrowser.openBrowserAsync(`https://www.youtube.com/results?search_query=${encodeURIComponent(video)}`)} />
      )}
      <View style={{ gap: 10, marginTop: 8 }}>
        {step.next && <Button variant="outline" icon="up" block title={tr('sheets.exercise.next', { name: step.next.name })} onPress={done(() => setStep(step.next!.id))} />}
        {step.prev && <Button icon="lower" block title={tr('sheets.exercise.prev', { name: step.prev.name })} onPress={done(() => setStep(step.prev!.id))} />}
        {slot.state === 'skipped'
          ? <Button variant="ghost" icon="undo" block title={tr('sheets.exercise.undoSkip')} onPress={done(() => t.updateToday(x => L.withSkip(x, ex.id, false)))} />
          : <Button variant="ghost" icon="skip" block title={tr('sheets.exercise.skip')} onPress={done(() => t.updateToday(x => L.withSkip(x, ex.id, true)))} />}
        {slot.state === 'paused'
          ? <Button variant="ghost" icon="play" block title={tr('sheets.exercise.resume')} onPress={done(() => t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) })))} />
          : <Button variant="danger" icon="pause" block title={tr('sheets.exercise.pause')} onPress={done(() => t.setState(st => ({ ...st, paused: [...new Set([...st.paused, slot.pid])] })))} />}
      </View>
    </FormSheet>
  )
}
