/* Erfassung im nativen Sheet (Route log-set): Satz-Kacheln, großer Zähler, Zusatzgewicht,
   Halte-Timer, Speichern, Notiz. Vorbelegung wie im Satz-Sheet; Speichern startet die Pause. */
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Keyboard, ScrollView, TextInput, View, type LayoutChangeEvent } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { useHoldTimer, type HoldTimer } from '@lever/core/useHoldTimer.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { setSheet, useSetSheet } from '@/state/set-sheet'
import { Button, ButtonRow, color, CountdownRing, font, GUTTER, Icon, radius, Text } from '@/ui'
import { NoteInput, SetTiles } from './parts'

const haptic = (k: 'tap' | 'success' = 'tap') => platform().signals.haptic(k)
const MINI_FLOAT = 28

/** Inhalt des nativen Erfassungs-Sheets, von oben nach unten so gestapelt, wie das Sheet beim
    Hochziehen aufgeht: Satz-Kacheln (kleine Stufe) · Zähler und Aktionen (Erfassung) · Notiz zum Satz
    mit den Werten vom letzten Mal (oberste Stufe). Die Höhen der Stufen misst es selbst. */
export function SetSheetContent({ slot }: { slot: L.SlotView }) {
  const { t } = useApp()
  const { sel } = useSetSheet()
  const ex = slot.step.exercise
  const setNo = slot.state === 'open' ? L.nextSetNo(slot) : null
  const [note, setNote] = useState('')
  useEffect(() => { setNote('') }, [setNo, slot.pid])
  const last = slot.last?.sets.length ? slot.last.sets.slice().sort((a, b) => a.set - b.set).map(x => L.fmtSet(x, ex)).join(' · ') : null
  const undo = () => slot.state === 'skipped'
    ? t.updateToday(x => L.withSkip(x, ex.id, false))
    : t.setState(st => ({ ...st, paused: st.paused.filter(p => p !== slot.pid) }))

  // Unterkanten der drei Blöcke → Höhen des Sheets (plus Luft und den Abstand, um den das Sheet
  // über dem unteren Rand schwebt)
  const bottom = 14
  const [edges, setEdges] = useState<[number, number, number]>([0, 0, 0])
  const edge = (i: 0 | 1 | 2) => (e: LayoutChangeEvent) => {
    const y = Math.round(e.nativeEvent.layout.y + e.nativeEvent.layout.height)
    setEdges(old => (Math.abs(old[i] - y) > 1 ? (old.map((v, j) => (j === i ? y : v)) as [number, number, number]) : old))
  }
  const withNote = setNo !== null
  useEffect(() => {
    if (!edges[0] || !edges[1] || (withNote && !edges[2])) return
    // kleine Stufe: iOS lässt das Sheet dort weiter über dem Rand schweben und rechnet den unteren Sicherheitsabstand nicht ein
    const d = [edges[0] + 4 + bottom + MINI_FLOAT, edges[1] + bottom, ...(withNote ? [edges[2] + 4 + bottom] : [])]
    const cur = setSheet.get().detents
    if (d.length !== cur.length || d.some((v, i) => Math.abs(v - cur[i]) > 1)) setSheet.set({ detents: d })
  }, [edges, withNote, bottom])

  // ganz hochgezogen: Notiz bekommt den Fokus; wieder kleiner: Tastatur weg
  const noteRef = useRef<ComponentRef<typeof TextInput>>(null)
  useEffect(() => {
    if (sel === 2 && withNote) { const id = setTimeout(() => noteRef.current?.focus(), 250); return () => clearTimeout(id) }
    Keyboard.dismiss()
  }, [sel, withNote])

  // Tastatur für die Notiz: hebt iOS das Sheet nicht weit genug an (wenig Platz), rückt der Inhalt
  // das Notizfeld über die Tastatur; Tipps auf „Satz speichern“ gehen trotzdem durch
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null)
  const [kb, setKb] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { setKb(true); setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60) })
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKb(false); scroll.current?.scrollTo({ y: 0, animated: true }) })
    return () => { show.remove(); hide.remove() }
  }, [])

  return (
    <ScrollView ref={scroll} style={{ flex: 1 }} scrollEnabled={kb} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false} accessibilityLabel={tr('training.focus.logSet')}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 4, gap: 12 }}>
      <View onLayout={edge(0)}><SetTiles slot={slot} setNo={setNo} /></View>
      <View onLayout={edge(1)}>
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
          <SetInput key={`${slot.pid}-${setNo}`} slot={slot} setNo={setNo} note={note} />
        )}
      </View>
      {withNote && (
        <View onLayout={edge(2)} style={{ gap: 10, paddingTop: 6 }}>
          {last && <Text variant="small">{tr('training.focus.lastTime', { sets: last })}</Text>}
          <NoteInput ref={noteRef} label={tr('training.focus.noteSet', { set: setNo })} value={note} onChangeText={setNote}
            placeholder={tr('training.focus.noteSetPlaceholder')} />
        </View>
      )}
    </ScrollView>
  )
}

/** Erfassung des nächsten Satzes – Vorbelegung wie im Satz-Sheet; Halteübungen mit Timer */
function SetInput({ slot, setNo, note }: { slot: L.SlotView; setNo: number; note: string }) {
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
    Keyboard.dismiss()
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
        {/* Hinweis, kein Knopf: die Notiz öffnet sich durch Hochziehen des Sheets */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel={tr('training.focus.noteHint')}>
          <Icon name="collapse" size={12} color={note.trim() ? color.accent : color.muted} />
          <Text variant="small" style={{ fontFamily: font.bodySemi, color: note.trim() ? color.accent : color.muted }}>{tr('training.focus.noteShort')}</Text>
        </View>
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
      {/* Zusatzgewicht als eine zusammenhängende Steuerung unter dem Zähler: gleiche Außenkanten wie −/+ darüber,
          Wert mit Beschriftung in der Mitte – zurückhaltender als die Wiederholungen */}
      {ex.weighted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: radius.pill, backgroundColor: color.card2, borderWidth: 1, borderColor: color.line }}>
          <Button icon="minus" variant="ghost" label={tr('training.focus.weightLess')} disabled={weight <= 0} onPress={() => setWeight(w => Math.max(0, +(w - 2.5).toFixed(1)))} />
          <View style={{ flex: 1, alignItems: 'center' }} accessible accessibilityLabel={`${tr('training.focus.weight')}: ${L.fmtNum(weight)} kg`}>
            <Text style={{ fontFamily: font.bodyBold, fontSize: 11, lineHeight: 13, letterSpacing: 0.8, textTransform: 'uppercase', color: color.muted }}>{tr('training.focus.weight')}</Text>
            <Text style={{ fontFamily: font.display, fontSize: 22, lineHeight: 26, color: weight ? color.text : color.muted, fontVariant: ['tabular-nums'] }}>
              {weight ? `+${L.fmtNum(weight)}` : '0'}<Text style={{ fontFamily: font.displaySemi, fontSize: 14, color: color.muted }}> kg</Text>
            </Text>
          </View>
          <Button icon="plus" variant="ghost" label={tr('training.focus.weightMore')} onPress={() => setWeight(w => +(w + 2.5).toFixed(1))} />
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

