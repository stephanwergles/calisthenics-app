/* Satz erfassen (Web: SetSheet) – Params pid, setNo. Wert, ggf. Zusatzgewicht, Halte-Timer bei
   Sekunden-Übungen, Notiz. Speichern startet Pause und Session; Löschen entfernt den Satz. */
import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { useHoldTimer } from '@lever/core/useHoldTimer.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, ButtonRow, Stepper } from '@/ui'
import { FormSheet, NoteInput } from '@/screens/training/parts'

export default function SetRoute() {
  const { pid, setNo } = useLocalSearchParams<{ pid: string; setNo: string }>()
  const { slots } = useApp()
  const slot = slots.find(s => s.pid === pid)
  const n = Number(setNo)
  if (!slot || !n) return <FormSheet title={tr('training.focus.logSet')} />
  return <SetForm key={`${pid}-${n}`} slot={slot} setNo={n} />
}

function SetForm({ slot, setNo }: { slot: L.SlotView; setNo: number }) {
  const { t, rest, pick } = useApp()
  const ex = slot.step.exercise, target = slot.step.target
  const existing = slot.sets.find(x => x.set === setNo)
  const init = L.prefill(slot.sets, slot.last?.sets ?? [], setNo, target, ex)
  const [value, setValue] = useState(init.value)
  const [weight, setWeight] = useState(init.weightKg)
  const [note, setNote] = useState(existing?.note ?? '')
  const [noteOpen, setNoteOpen] = useState(!!existing?.note)
  const seconds = ex.unit === 'seconds'
  const stepBy = seconds ? 5 : 1
  const hold = useHoldTimer()
  const timing = hold.phase === 'prep' || hold.phase === 'hold'

  const save = () => {
    const n = L.cleanNote(note)
    t.updateToday(s => L.withSet(s, { exercise: ex.id, progression: slot.pid, set: setNo, value, ...(weight ? { weightKg: weight } : {}), ...(n ? { note: n } : {}) }))
    t.startSession()
    rest.start(target.restSec)
    platform().signals.haptic('success')
    // letzte offene Satz-Nummer erfasst → Fokus wandert zur nächsten offenen Übung
    if (slot.sets.length + 1 >= slot.planned && !slot.sets.some(x => x.set === setNo)) pick(undefined)
    router.back()
  }
  const remove = () => { t.updateToday(s => L.withoutSet(s, ex.id, setNo)); router.back() }
  const valueLabel = seconds ? tr('sheets.set.seconds') : tr('sheets.set.reps')
  const weightLabel = tr('sheets.set.weight')

  return (
    <FormSheet title={ex.name} sub={tr('sheets.set.sub', { set: setNo, planned: slot.planned, target: target.label })}
      footer={
        <ButtonRow>
          {existing && <Button variant="danger" size="lg" icon="trash" title={tr('sheets.set.delete')} onPress={remove} />}
          <Button variant="primary" size="lg" icon="check" title={tr('sheets.save')} onPress={save} style={{ flex: 1 }} />
        </ButtonRow>
      }>
      <Stepper label={valueLabel} value={`${value}${seconds ? ' s' : ''}`}
        minusLabel={tr('sheets.decrease', { label: valueLabel })} plusLabel={tr('sheets.increase', { label: valueLabel })}
        onMinus={() => setValue(v => Math.max(1, v - stepBy))} onPlus={() => setValue(v => v + stepBy)} />
      {ex.weighted && (
        <Stepper label={weightLabel} value={`${L.fmtNum(weight)} kg`}
          minusLabel={tr('sheets.decrease', { label: weightLabel })} plusLabel={tr('sheets.increase', { label: weightLabel })}
          onMinus={() => setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))} onPlus={() => setWeight(w => +(w + 2.5).toFixed(1))} />
      )}
      {seconds && (
        timing
          ? <Button icon="close" block title={`${hold.left} s · ${tr('training.focus.cancelTimer')}`} onPress={hold.cancel} />
          : <Button variant="outline" icon="timer" block
              title={hold.phase === 'done' ? tr('training.focus.again', { n: value }) : tr('sheets.set.startTimer', { n: value })}
              onPress={() => hold.start(value)} />
      )}
      {noteOpen ? (
        <NoteInput label={tr('sheets.set.note')} value={note} onChangeText={setNote} autoFocus={!existing?.note}
          placeholder={tr('sheets.set.notePlaceholder')} />
      ) : (
        <View>
          <Button variant="ghost" icon="note" block title={tr('sheets.set.addNote')} onPress={() => setNoteOpen(true)} />
        </View>
      )}
    </FormSheet>
  )
}
