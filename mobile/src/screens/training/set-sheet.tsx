/* Erfassung im nativen Sheet (Route log-set): Satz-Kacheln, großer Zähler, Zusatzgewicht,
   Halte-Timer, Speichern. Vorbelegung wie im Satz-Sheet; Speichern startet die Pause. */
import { useEffect, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { useHoldTimer, type HoldTimer } from '@lever/core/useHoldTimer.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { setSheet } from '@/state/set-sheet'
import { Button, ButtonRow, color, CountdownRing, font, GUTTER, Icon, Text } from '@/ui'
import { NoteInput, SetTiles } from './parts'

const haptic = (k: 'tap' | 'success' = 'tap') => platform().signals.haptic(k)

/** Inhalt des nativen Erfassungs-Sheets: Satz-Kacheln, Zähler und Aktionen; die Notiz zum Satz
    (mit den Werten vom letzten Mal) klappt der Notiz-Knopf auf – das Sheet passt seine Höhe an. */
export function SetSheetContent({ slot }: { slot: L.SlotView }) {
  const { t } = useApp()
  const ex = slot.step.exercise
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => { setNote(''); setNoteOpen(false) }, [setNo, slot.pid])
  const last = slot.last?.sets.length ? slot.last.sets.slice().sort((a, b) => a.set - b.set).map(x => L.fmtSet(x, ex)).join(' · ') : null
  const undo = () => slot.state === 'skipped'
    ? t.updateToday(x => L.withSkip(x, ex.id, false))
    : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))
  const onLayout = (e: LayoutChangeEvent) => { const h = Math.round(e.nativeEvent.layout.height); if (Math.abs(h - setSheet.get().height) > 1) setSheet.set({ height: h }) }

  return (
    <View onLayout={onLayout} accessibilityLabel={tr('training.focus.logSet')}
      // unten kein Sicherheitsabstand: fitToContents rechnet ihn auf iOS schon ein
      style={{ paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 4, gap: 12 }}>
      <SetTiles slot={slot} setNo={setNo} />
      {noteOpen && setNo !== null && (
        <View style={{ gap: 10 }}>
          {last && <Text variant="small">{tr('training.focus.lastTime', { sets: last })}</Text>}
          <NoteInput label={tr('training.focus.noteSet', { set: setNo })} value={note} onChangeText={setNote} autoFocus
            placeholder={tr('training.focus.noteSetPlaceholder')} />
        </View>
      )}
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
        <SetInput key={`${slot.pid}-${setNo}`} slot={slot} setNo={setNo} note={note} onNote={() => { haptic(); setNoteOpen(x => !x) }} />
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

