/* Eigene Challenge anlegen oder bearbeiten: Name, Art (so viele wie möglich / auf Zeit / am Stück),
   je nach Art Zeit, Zielzahl oder Messgröße, optional eine Übung (für Clip und Technik).
   Die Übung wählt man auf einer Push-Seite; sie kommt als Parameter `exercise` zurück. */
import { useEffect, useState } from 'react'
import { TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { toast } from '@lever/core/toast.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Challenge } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { Button, color, font, radius, Segmented, SheetScreen, Stepper, Text } from '@/ui'
import { ModalToolbar, Rows, Section, useIsFirst } from '@/screens/plan/parts'

type Kind = Challenge['kind']

export default function EditChallenge() {
  const { t } = useApp()
  const first = useIsFirst()
  const params = useLocalSearchParams<{ id?: string; exercise?: string }>()
  const existing = params.id ? t.state.challenges?.find(c => c.id === params.id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'amrap')
  const [unit, setUnit] = useState<Challenge['unit']>(existing?.unit ?? 'reps')
  const [seconds, setSeconds] = useState(existing?.seconds ?? 120)
  const [target, setTarget] = useState(existing?.target ?? 50)
  const [exercise, setExercise] = useState<string | undefined>(existing?.exercise)
  // Rückgabe der Übungsauswahl; ohne Namen den Übungsnamen vorschlagen
  useEffect(() => {
    if (params.exercise === undefined) return
    const id = params.exercise || undefined
    setExercise(id)
    if (id && !name.trim()) setName(t.ix.exercises.get(id)?.name ?? '')
  }, [params.exercise]) // eslint-disable-line react-hooks/exhaustive-deps

  const ex = exercise ? t.ix.exercises.get(exercise) : undefined
  const clean = name.replace(/\s+/g, ' ').trim()
  const save = () => {
    if (!clean) return
    t.setState(st => L.withChallenge(st, { id: existing?.id, name: clean, kind, unit, seconds, target, exercise }))
    if (!existing) toast(tr('challenge.created'), 'success')
    router.back()
  }
  const fmtTime = (s: number) => (s % 60 === 0 ? `${s / 60} min` : L.fmtClock(s))

  return (
    <>
    <ModalToolbar close={first} />
    <SheetScreen title={existing ? tr('challenge.editTitle') : tr('challenge.newTitle')}
      footer={<Button variant="primary" size="lg" icon="check" disabled={!clean} title={existing ? tr('challenge.saveChanges') : tr('challenge.create_ok')} onPress={save} />}>
      <View style={{ gap: 6 }}>
        <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('challenge.name')}</Text>
        <TextInput value={name} onChangeText={setName} maxLength={80} placeholder={tr('challenge.namePlaceholder')}
          placeholderTextColor={color.muted} returnKeyType="done" accessibilityLabel={tr('challenge.name')}
          selectionColor={color.accent} keyboardAppearance="dark" autoCapitalize="sentences"
          style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: radius.lg, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line,
            backgroundColor: color.card, color: color.text, fontFamily: font.bodyMedium, fontSize: 17 }} />
      </View>

      <Section title={tr('challenge.kind')} />
      <Segmented label={tr('challenge.kind')} value={kind} onChange={v => setKind(v as Kind)}
        options={[{ id: 'amrap', title: tr('challenge.kindAmrap') }, { id: 'fortime', title: tr('challenge.kindFortime') }, { id: 'max', title: tr('challenge.kindMax') }]} />
      <Text variant="small">{tr(`challenge.kindHint.${kind}`)}</Text>

      {kind === 'amrap' && (
        <Stepper label={tr('challenge.time')} value={fmtTime(seconds)}
          minusLabel={tr('sheets.decrease', { label: tr('challenge.time') })} plusLabel={tr('sheets.increase', { label: tr('challenge.time') })}
          onMinus={() => setSeconds(s => Math.max(15, s - (s > 60 ? 30 : 15)))} onPlus={() => setSeconds(s => Math.min(3600, s + (s >= 60 ? 30 : 15)))} />
      )}
      {kind === 'fortime' && (
        <Stepper label={tr('challenge.target')} value={String(target)}
          minusLabel={tr('sheets.decrease', { label: tr('challenge.target') })} plusLabel={tr('sheets.increase', { label: tr('challenge.target') })}
          onMinus={() => setTarget(n => Math.max(5, n - (n > 50 ? 10 : 5)))} onPlus={() => setTarget(n => Math.min(10000, n + (n >= 50 ? 10 : 5)))} />
      )}
      {kind === 'max' && <>
        <Section title={tr('challenge.measure')} />
        <Segmented label={tr('challenge.measure')} value={unit} onChange={v => setUnit(v as Challenge['unit'])}
          options={[{ id: 'reps', title: tr('challenge.measureReps') }, { id: 'seconds', title: tr('challenge.measureHold') }]} />
      </>}

      <Section title={tr('challenge.exercise')} />
      <Rows rows={[{
        key: 'ex', title: ex?.name ?? tr('challenge.noExercise'), subtitle: tr('challenge.pickExercise'), exercise: ex,
        icon: ex ? undefined : 'flame', iconTile: !ex,
        onPress: () => router.push({ pathname: '/challenges/exercise', params: { id: existing?.id ?? '', current: exercise ?? '' } }),
      }]} />
    </SheetScreen>
    </>
  )
}
