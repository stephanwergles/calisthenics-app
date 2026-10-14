/* Übungsplan des Tages (Web: PlanSheet in WorkoutView): vor dem Start Vorschau mit Start-Button,
   im Training Liste zum Springen. Warm-up/Cool-down als Checklisten (Cardio-Punkt öffnet das
   Cardio-Sheet), Notiz zur Einheit, Tagesanpassung (weglassen/hinzufügen, nur heute) und
   „Als neues Workout speichern“. Hinzufügen und Speichern sind Unterseiten im selben Modal. */
import { useEffect, useRef, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import type { RoutineItem } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { CloseButton } from '@/navigation'
import { Button, color, font, Icon, radius, SectionTitle, SheetScreen, space, Text } from '@/ui'
import { ChecklistGroup, ExerciseRow, NoteInput, ProgressBar } from './parts'

type Mode = 'list' | 'edit' | 'add' | 'save'

export function PlanScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  const inTraining = from === 'training'
  const { t, slots, focus, pick, openTraining, start } = useApp()
  const [mode, setMode] = useState<Mode>('list')
  const w = t.ix.workouts.get(t.workout)!
  const today = t.todaySession

  // aus dem Training: Fokus setzen und zurück; sonst Liste schließen und Training öffnen
  const openFocus = (pid: string) => {
    if (inTraining) { pick(pid); router.back() } else { router.back(); openTraining(pid) }
  }
  const onStart = t.active ? undefined : () => {
    if (inTraining) { t.startSession(); router.back() } else { router.back(); start() }
  }
  const back = () => setMode(m => (m === 'add' || m === 'save' ? 'edit' : 'list'))

  const counted = slots.filter(s => s.state !== 'skipped' && s.state !== 'paused')
  const planned = counted.reduce((n, s) => n + s.planned, 0)
  const done = counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const skipped = slots.filter(s => s.state === 'skipped').length
  const paused = slots.filter(s => s.state === 'paused').length
  const sub = `${w.name} · ${tn('training.plan.exercises', counted.length)} · ${tn('training.plan.sets', planned)}${skipped ? ` · ${tr('training.plan.skippedN', { n: skipped })}` : ''}${paused ? ` · ${tr('training.plan.pausedN', { n: paused })}` : ''}`

  const header = (
    <>
      <Stack.Screen options={{ headerShown: true, headerTransparent: true, title: '', headerTitle: '', headerShadowVisible: false }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.left" hidden={mode === 'list'} onPress={back} accessibilityLabel={tr('common.back')} />
      </Stack.Toolbar>
      <CloseButton />
    </>
  )

  if (mode === 'add') return (
    <>{header}<AddExercise exclude={slots.map(s => s.pid)} onPick={pid => { t.updateToday(x => L.withAdded(x, pid)); setMode('edit') }} /></>
  )
  if (mode === 'save') return (
    <>{header}<SaveAs initial={tr('training.plan.adjustedName', { name: w.name })} onSave={name => {
      const nw = L.workoutFromDay(t.ix, t.workout, today, name)
      t.editPlan(p => L.withWorkout(p, nw))
      setMode('list')
      router.back()
      router.push({ pathname: '/workouts/[id]', params: { id: nw.id } })
    }} /></>
  )

  const editing = mode === 'edit'
  return (
    <>
      {header}
      <SheetScreen title={w.focus} sub={sub}
        footer={editing
          ? <Button variant="primary" size="lg" icon="check" block title={tr('training.done')} onPress={() => setMode('list')} />
          : onStart ? <Button variant="primary" size="lg" icon="play" block title={tr('training.bar.start', { name: w.name })} onPress={onStart} /> : undefined}>
        {done > 0 && <ProgressBar done={done} total={planned} label={tr('training.plan.progress')} />}
        {editing ? <Adjust onAdd={() => setMode('add')} onSave={() => setMode('save')} />
          : <Overview focus={focus} onOpen={openFocus} onAdjust={() => setMode('edit')} />}
      </SheetScreen>
    </>
  )
}

/** Übersicht: Warm-up, Übungen, Heute anpassen, Cool-down, Notiz */
function Overview({ focus, onOpen, onAdjust }: { focus: string | undefined; onOpen: (pid: string) => void; onAdjust: () => void }) {
  const { t, slots } = useApp()
  const w = t.ix.workouts.get(t.workout)!
  const today = t.todaySession
  const adjusted = L.isAdjusted(today)
  const adjustNote = adjusted ? tr('training.plan.adjusted', { list: [today?.added?.length ? tr('training.plan.addedN', { n: today.added.length }) : '', today?.removed?.length ? tr('training.plan.removedN', { n: today.removed.length }) : ''].filter(Boolean).join(', ') }) : undefined
  const cool = w.cooldown.some(i => i.cardio) ? tr('training.plan.cardioCooldown') : tr('training.plan.cooldown')
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ gap: space.md }}>
      <Routine title={tr('training.plan.warmup')} items={w.warmup} />
      <View style={{ gap: 8 }}>
        {slots.map(s => {
          const next = s.pid === focus && s.state === 'open'
          const trailing = s.state === 'done' ? s.sets.map(x => x.value).join(' · ')
            : s.state === 'skipped' ? tr('training.plan.skipped') : s.state === 'paused' ? (s.blockedBy ?? tr('training.plan.paused'))
            : s.sets.length ? `${s.sets.length}/${s.planned}` : s.step.target.label
          const lines = [
            ...(s.state === 'open' && s.last ? [{ text: tr('training.plan.last', { sets: s.last.sets.map(x => x.value).join(' · ') }) }] : []),
            ...(s.ready ? [{ text: tr('training.plan.ready'), accent: true }] : []),
          ]
          return (
            <ExerciseRow key={s.pid} exercise={s.step.exercise} title={s.step.exercise.name} lines={lines} trailing={trailing}
              eyebrow={next ? tr('training.plan.next') : s.substituteFor ? tr('training.plan.substitute', { name: s.substituteFor }) : s.added ? tr('training.plan.onlyTodayLabel') : undefined}
              mark={s.state === 'open' ? null : s.state} highlight={next} dim={s.state === 'skipped' || s.state === 'paused'}
              label={[next ? tr('training.plan.next') : null, s.step.exercise.name, ...lines.map(l => l.text), s.state === 'done' ? tr('training.plan.stateDone') : null, trailing].filter(Boolean).join(', ')}
              onPress={() => onOpen(s.pid)} />
          )
        })}
      </View>
      <Button variant="ghost" icon="adjust" block title={tr('training.plan.adjust')} onPress={onAdjust} />
      {adjustNote && <Text variant="small" style={{ textAlign: 'center' }}>{adjustNote}</Text>}
      <Routine title={cool} items={w.cooldown} />
      <SessionNote key={`${t.today}-${t.workout}`} />
    </Animated.View>
  )
}

/** Warm-up/Cool-down: Haken in der Einheit; der Cardio-Punkt öffnet das Cardio-Sheet und gilt als
    erledigt, sobald heute Cardio eingetragen ist */
function Routine({ title, items }: { title: string; items: RoutineItem[] }) {
  const { t } = useApp()
  const doneIds = t.todaySession?.routineDone ?? []
  const todays = t.activities.filter(a => a.date === t.today)
  const isDone = (it: RoutineItem) => (it.cardio ? todays.length > 0 : doneIds.includes(it.id))
  return (
    <ChecklistGroup title={title}
      items={items.map(it => ({
        id: it.id, title: it.name, on: isDone(it),
        sub: it.cardio && todays.length ? todays.map(a => [L.activityTitle(a), L.fmtActivity(a)].filter(Boolean).join(' · ')).join(', ') : it.detail,
      }))}
      onToggle={(id, on) => {
        const it = items.find(x => x.id === id)
        if (it?.cardio) router.push({ pathname: '/activity', params: { date: t.today } })
        else t.updateToday(s => L.withRoutine(s, id, on))
      }} />
  )
}

/** Notiz zur Einheit – speichert 1,5 s nach der letzten Eingabe, beim Verlassen des Feldes und
    beim Schließen (jede Speicherung ist eine Sync-Änderung) */
function SessionNote() {
  const { t } = useApp()
  const saved = t.todaySession?.note ?? ''
  const [text, setText] = useState(saved)
  const [open, setOpen] = useState(!!saved)
  const commit = useRef(() => {})
  useEffect(() => {
    commit.current = () => { if ((L.cleanNote(text) ?? '') !== saved) t.updateToday(s => L.withNote(s, text)) }
  })
  useEffect(() => {
    if ((L.cleanNote(text) ?? '') === saved) return
    const id = setTimeout(() => commit.current(), 1500)
    return () => clearTimeout(id)
  }, [text, saved])
  useEffect(() => () => commit.current(), [])
  if (!open) return <Button variant="ghost" icon="note" block title={tr('training.noteSession')} onPress={() => setOpen(true)} />
  return (
    <NoteInput label={tr('training.noteSession')} value={text} onChangeText={setText} autoFocus={!saved}
      onBlur={() => commit.current()} placeholder={tr('training.plan.notePlaceholder')} />
  )
}

/** Tagesanpassung: Übungen nur für heute weglassen/hinzufügen; trainierte bleiben drin */
function Adjust({ onAdd, onSave }: { onAdd: () => void; onSave: () => void }) {
  const { t } = useApp()
  const w = t.ix.workouts.get(t.workout)!
  const today = t.todaySession
  const list = [
    ...w.slots.filter(sl => t.ix.progressions.has(sl.progression)).map(sl => ({ pid: sl.progression, added: false, on: !today?.removed?.includes(sl.progression) })),
    ...(today?.added ?? []).filter(pid => t.ix.progressions.has(pid) && !w.slots.some(sl => sl.progression === pid)).map(pid => ({ pid, added: true, on: true })),
  ].map(x => {
    const step = L.currentStep(t.ix, t.state, x.pid)
    return { ...x, step, trained: L.setsOf(today, step.exercise.id).length > 0 }
  })
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ gap: space.md }}>
      <Text variant="muted">{tr('training.plan.adjustHint')}</Text>
      <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, paddingHorizontal: 16, paddingVertical: 4 }}>
        {list.map(x => (
          <AdjustRow key={x.pid} title={x.step.exercise.name} on={x.on} disabled={x.trained}
            sub={[x.added ? tr('training.plan.onlyToday') : null, x.trained ? tr('training.plan.trained') : x.step.target.label].filter(Boolean).join(' · ')}
            onToggle={() => t.updateToday(s => L.withRemoved(s, x.pid, x.on))} />
        ))}
      </View>
      <Button icon="plus" block title={tr('training.plan.addExercise')} onPress={onAdd} />
      {L.isAdjusted(today) && <Button variant="outline" icon="import" block title={tr('training.plan.saveAs')} onPress={onSave} />}
    </Animated.View>
  )
}

function AdjustRow({ title, sub, on, disabled, onToggle }: { title: string; sub: string; on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} accessibilityLabel={`${title}, ${sub}`}
      onPress={() => { platform().signals.haptic('tap'); onToggle() }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingVertical: 8, opacity: disabled ? 0.55 : pressed ? 0.7 : 1 })}>
      <View style={{
        width: 24, height: 24, borderRadius: 7, borderCurve: 'continuous', borderWidth: on ? 0 : 1.5, borderColor: color.muted,
        backgroundColor: on ? color.accent : 'transparent', alignItems: 'center', justifyContent: 'center',
      }}>
        {on && <Icon name="check" size={14} color={color.onAccent} weight="bold" />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="label" style={{ color: on ? color.text : color.muted }}>{title}</Text>
        <Text variant="small">{sub}</Text>
      </View>
    </Pressable>
  )
}

/** Unterseite: Übung hinzufügen (nur heute) – Leitern nach Körperregion, mit aktueller Stufe */
function AddExercise({ exclude, onPick }: { exclude: string[]; onPick: (pid: string) => void }) {
  const { t } = useApp()
  const groups = L.ladderChoices(t.ix, t.state, exclude)
  return (
    <SheetScreen title={tr('editor.addExercise')} sub={tr('training.plan.addHint')}>
      <Animated.View entering={FadeIn.duration(160)}>
        {groups.map(g => (
          <View key={g.id}>
            <SectionTitle title={g.label} />
            <View style={{ gap: 8 }}>
              {g.items.map(x => (
                <ExerciseRow key={x.pid} exercise={x.exercise} title={x.name} lines={[{ text: x.sub }]} mark="add" onPress={() => onPick(x.pid)} />
              ))}
            </View>
          </View>
        ))}
      </Animated.View>
    </SheetScreen>
  )
}

/** Unterseite: Name für das neue Workout */
function SaveAs({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const clean = name.replace(/\s+/g, ' ').trim()
  const save = () => { if (clean) onSave(clean.slice(0, 80)) }
  return (
    <SheetScreen title={tr('training.plan.saveAs')} sub={tr('training.plan.saveAsSub')}
      footer={<Button variant="primary" size="lg" icon="check" block disabled={!clean} title={tr('training.plan.save')} onPress={save} />}>
      <View style={{ gap: 6 }}>
        <Text variant="small" style={{ fontFamily: font.bodySemi }}>{tr('editor.name')}</Text>
        <TextInput value={name} onChangeText={setName} autoFocus maxLength={80} returnKeyType="done" onSubmitEditing={save}
          placeholder={tr('editor.namePlaceholder')} placeholderTextColor={color.muted} keyboardAppearance="dark" selectionColor={color.accent}
          accessibilityLabel={tr('editor.name')} clearButtonMode="while-editing"
          style={{ height: 52, paddingHorizontal: 16, borderRadius: radius.lg, borderCurve: 'continuous', backgroundColor: color.card2, borderWidth: 1, borderColor: color.line, color: color.text, fontFamily: font.bodySemi, fontSize: 17 }} />
      </View>
    </SheetScreen>
  )
}
