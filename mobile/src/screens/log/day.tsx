/* Tag im Verlauf (Route day/[id], Param-Format in ./params): eine Einheit mit Kennzahlen,
   Bestwerten, jeder Übung mit Stufe, Sätzen, Notizen und Vergleich – oder ein Cardio-Eintrag – oder
   ein leerer Tag mit „Cardio eintragen“. Löschen mit Rückfrage; Einheiten nur als Lösch-Markierung.
   (Web: DaySheet in HistoryView) */
import { useMemo } from 'react'
import { View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { getLocale, t as tr, tn } from '@lever/core/i18n/index.ts'
import type { Activity, RoutineItem, Session, SetLog } from '@lever/domain/model.ts'
import type { Training } from '@lever/core/useTraining.ts'
import { useApp } from '@/state/app'
import { CloseButton, stackScreenOptions } from '@/navigation'
import { Button, color, font, Icon, radius, SheetScreen, Text } from '@/ui'
import { parseDayParam } from './params'
import { NoteLine, SetChips, StatTiles } from './parts'
import { confirmRemoveActivity, confirmRemoveSession } from './actions'

export function Day() {
  const { t } = useApp()
  const { id } = useLocalSearchParams<{ id: string }>()
  const item = parseDayParam(id)
  // leerer Tag: wurde inzwischen etwas eingetragen (Cardio nachgetragen), zeigt der Tag das
  const empty = item?.kind === 'empty' ? item.id : null
  const session = item?.kind === 'session' ? t.sessions.find(x => x.id === item.id)
    : empty ? t.sessions.find(x => x.date === empty && L.isTrained(x)) : undefined
  const activity = item?.kind === 'activity' ? t.activities.find(x => x.id === item.id)
    : empty ? t.activities.find(x => x.date === empty) : undefined
  return (
    <>
      <Stack.Screen options={{ ...stackScreenOptions, headerShown: true }} />
      <CloseButton />
      {session && L.isTrained(session) ? <SessionDetail t={t} s={session} />
        : activity ? <ActivityDetail t={t} a={activity} />
        : empty ? <EmptyDay date={empty} />
        : <SheetScreen><Text variant="muted" style={{ paddingTop: 24, textAlign: 'center' }}>{tr('history.notFound')}</Text></SheetScreen>}
    </>
  )
}

/** Tag ohne Eintrag: zeigen statt gleich ein Formular zu öffnen – Cardio nachtragen ist eine Option */
function EmptyDay({ date }: { date: string }) {
  return (
    <SheetScreen title={L.fmtDate(date)}>
      <Text variant="muted">{tr('history.emptyDay')}</Text>
      <Button icon="plus" block title={tr('history.addCardio')} onPress={() => router.push({ pathname: '/activity', params: { date } })} />
    </SheetScreen>
  )
}

function ActivityDetail({ t, a }: { t: Training; a: Activity }) {
  const facts = L.fmtActivity(a)
  return (
    <SheetScreen title={L.activityTitle(a)} sub={L.fmtDate(a.date)}
      footer={
        <>
          <Button icon="edit" block title={tr('history.editActivity')} onPress={() => router.push({ pathname: '/activity', params: { date: a.date, id: a.id, from: 'day' } })} />
          <Button variant="danger" icon="trash" block title={tr('history.deleteActivity')} onPress={async () => { if (await confirmRemoveActivity(t, a)) router.back() }} />
        </>
      }>
      {facts ? <Text variant="title" style={{ fontSize: 24, lineHeight: 26 }}>{facts}</Text> : null}
      {a.note ? <NoteLine text={a.note} /> : null}
    </SheetScreen>
  )
}

function SessionDetail({ t, s }: { t: Training; s: Session }) {
  const locale = getLocale()
  const w = t.ix.workouts.get(s.workout)
  const sum = useMemo(() => L.sessionSummary(t.ix, t.sessions, s), [t.ix, t.sessions, s, locale])
  const rows = useMemo(() => L.sessionExercises(t.ix, s), [t.ix, s, locale])
  const h = Math.floor(sum.durationSec / 3600), m = Math.round((sum.durationSec % 3600) / 60)
  const stepOf = (x: SetLog) => {
    const p = t.ix.progressions.get(x.progression)
    const i = p?.steps.findIndex(st => st.exercise === x.exercise) ?? -1
    return p && p.steps.length > 1 && i >= 0 ? tr('logic.stage', { i: i + 1, n: p.steps.length }) : null
  }
  const routine = (items: RoutineItem[]) => items.filter(it => !it.cardio).length
    ? `${items.filter(it => !it.cardio && s.routineDone.includes(it.id)).length}/${items.filter(it => !it.cardio).length}` : null
  const warm = w ? routine(w.warmup) : null, cool = w ? routine(w.cooldown) : null
  const skipped = s.skipped.map(id => t.ix.exercises.get(id)?.name).filter(Boolean)
  const repsDelta = sum.repsDelta ? `${sum.repsDelta > 0 ? '+' : '−'}${Math.abs(sum.repsDelta)}` : null

  return (
    <SheetScreen title={w ? w.focus : s.workout} sub={`${L.fmtDate(s.date)}${w ? ` · ${w.name}` : ''}`}
      footer={<Button variant="danger" icon="trash" block title={tr('history.deleteSession')} onPress={async () => { if (await confirmRemoveSession(t, s)) router.back() }} />}>
      <StatTiles items={[
        { value: sum.durationSec ? (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) : '–', label: h ? tr('history.hours') : tn('history.minutes', m) },
        { value: String(sum.sets), label: tn('history.setsLabel', sum.sets) },
        {
          value: String(sum.reps), label: tr('history.repsLabel'),
          a11y: `${sum.reps} ${tr('history.repsLabel')}${repsDelta ? `, ${repsDelta}` : ''}`,
          extra: repsDelta ? <Text style={{ fontFamily: font.bodyBold, fontSize: 12, color: (sum.repsDelta ?? 0) > 0 ? color.accent : color.text }}> · {repsDelta}</Text> : null,
        },
      ]} />
      {s.note ? <NoteLine text={s.note} /> : null}

      {sum.records.length > 0 && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text variant="title" accessibilityRole="header">{tr('history.records')}</Text>
          {sum.records.map(r => {
            const text = r.kind === 'weight'
              ? (r.before ? tr('history.recordWeight', { value: r.value, before: r.before }) : tr('history.recordWeightFirst', { value: r.value }))
              : tr('history.recordBest', { value: r.value, unit: r.exercise.unit === 'seconds' ? ' s' : '', before: String(r.before) })
            return (
              <View key={`${r.exercise.id}-${r.kind}`} accessible accessibilityLabel={`${r.exercise.name}, ${text}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderCurve: 'continuous', backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accentLine }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trophy" size={20} color={color.onAccent} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="label">{r.exercise.name}</Text>
                  <Text variant="small">{text}</Text>
                </View>
                <Text variant="num" style={{ fontSize: 26, color: color.accent }}>{r.kind === 'weight' ? `+${r.value}` : r.value}</Text>
              </View>
            )
          })}
        </View>
      )}

      {rows.length > 0 ? (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text variant="title" accessibilityRole="header">{tr('history.exercises')}</Text>
          {rows.map(r => {
            const c = sum.compare.find(x => x.exercise.id === r.exercise.id)
            const d = c ? c.now - c.before : null
            const step = stepOf(r.sets[0])
            const dText = d !== null ? `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}` : null
            return (
              <View key={r.exercise.id} style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.xl, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: color.glassLine }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" style={{ fontSize: 15.5 }}>{r.exercise.name}</Text>
                    {step ? <Text style={{ fontFamily: font.bodySemi, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: color.muted }}>{step}</Text> : null}
                  </View>
                  {dText ? (
                    <Text variant="num" accessibilityLabel={`${tr('history.sinceLast')}: ${dText}`} style={{ fontSize: 17, lineHeight: 20, color: d! > 0 ? color.accent : color.muted }}>{dText}</Text>
                  ) : null}
                </View>
                <SetChips sets={r.sets} seconds={r.exercise.unit === 'seconds'} />
                {L.notesOf(r.sets).map(n => <NoteLine key={n.set} size="sm" text={tr('history.setNote', { n: n.set, note: n.note })} />)}
              </View>
            )
          })}
        </View>
      ) : (
        <Text variant="muted" style={{ textAlign: 'center', paddingVertical: 12 }}>{tr('history.noSets', { extra: sum.durationSec ? tr('history.noSetsTimeOnly') : '' })}</Text>
      )}

      {(skipped.length > 0 || warm || cool) && (
        <View style={{ gap: 4, marginTop: 6 }}>
          {warm ? <Text variant="body">{tr('history.warmup', { n: warm })}</Text> : null}
          {cool ? <Text variant="body">{tr('history.cooldown', { n: cool })}</Text> : null}
          {skipped.length > 0 ? <Text variant="muted">{tr('history.skipped', { list: skipped.join(', ') })}</Text> : null}
        </View>
      )}
    </SheetScreen>
  )
}
