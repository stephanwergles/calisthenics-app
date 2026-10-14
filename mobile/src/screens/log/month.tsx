/* Log → Monat: Kalender mit Markierungen und Monatswechsel, Monatsbilanz, darunter alle Einheiten
   und Cardio-Einträge des Monats als Feed (neueste zuerst). Tag antippen wählt ihn aus: Der Feed zeigt
   dann nur diesen Tag (oder dass nichts eingetragen ist), Cardio nachtragen gilt für ihn; nochmal
   antippen zeigt wieder den Monat. Feed-Einträge haben ein Kontextmenü (lange drücken) mit Löschen. */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Link, router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { getLocale, intl, t as tr, tn } from '@lever/core/i18n/index.ts'
import type { Activity, Session } from '@lever/domain/model.ts'
import { platform } from '@lever/core/platform.ts'
import type { Training } from '@lever/core/useTraining.ts'
import { Button, color, font, Icon, radius, Text } from '@/ui'
import { dayHref, type DayItem } from './params'
import { confirmRemoveActivity, confirmRemoveSession } from './actions'

type FeedItem = { kind: 'session'; id: string; date: string; s: Session } | { kind: 'activity'; id: string; date: string; a: Activity }

export function Month({ t, month, setMonth }: { t: Training; month: string; setMonth: (m: string) => void }) {
  const locale = getLocale()
  const marks = useMemo(() => L.calendarMarks(t.sessions, t.activities), [t.sessions, t.activities])
  const grid = L.monthGrid(month)
  const stats = useMemo(() => L.monthStats(t.sessions, t.activities, month), [t.sessions, t.activities, month, locale])
  const hours = Math.floor(stats.durationSec / 3600), mins = Math.round((stats.durationSec % 3600) / 60)
  const feed = useMemo<FeedItem[]>(() => [
    ...t.sessions.filter(s => s.date.startsWith(month) && L.isTrained(s)).map(s => ({ kind: 'session' as const, id: s.id, date: s.date, s })),
    ...t.activities.filter(a => a.date.startsWith(month)).map(a => ({ kind: 'activity' as const, id: a.id, date: a.date, a })),
  ].sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : x.kind === 'session' ? -1 : 1)), [t.sessions, t.activities, month])
  const thisMonth = t.today.slice(0, 7)
  const addCardio = (date: string) => router.push({ pathname: '/activity', params: { date } })
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => setSelected(null), [month])
  const shown = selected ? feed.filter(f => f.date === selected) : feed
  // nach Tag gruppiert (Feed ist schon nach Datum sortiert)
  const days = shown.reduce<{ date: string; items: FeedItem[] }[]>((out, f) => {
    const last = out[out.length - 1]
    if (last?.date === f.date) last.items.push(f); else out.push({ date: f.date, items: [f] })
    return out
  }, [])
  const pickDay = (d: string) => setSelected(cur => (cur === d ? null : d))

  return (
    <View style={{ gap: 14 }}>
      {/* Kalender-Karte */}
      <View style={{ backgroundColor: color.card, borderWidth: 1, borderColor: color.line, borderRadius: 24, borderCurve: 'continuous', paddingTop: 14, paddingHorizontal: 10, paddingBottom: 12, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 }}>
          <Text variant="title" accessibilityRole="header" style={{ fontSize: 21, letterSpacing: 0.8 }}>{L.fmtMonth(month)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button icon="left" label={tr('history.prevMonth')} onPress={() => setMonth(L.shiftMonth(month, -1))} />
            <Button icon="right" label={tr('history.nextMonth')} disabled={month >= thisMonth} onPress={() => setMonth(L.shiftMonth(month, 1))} />
          </View>
        </View>

        <View accessible accessibilityLabel={`${tr('history.balance', { month: L.fmtMonth(month) })}: ${stats.sessions} ${tn('history.sessionsLabel', stats.sessions)}, ${hours ? `${hours}:${String(mins).padStart(2, '0')} ${tr('history.hours')}` : `${mins} ${tn('history.minutes', mins)}`}, ${stats.cardio} ${tr('history.cardio')}`}
          style={{ flexDirection: 'row', gap: 26, paddingHorizontal: 6 }}>
          <MonthStat value={String(stats.sessions)} label={tn('history.sessionsLabel', stats.sessions)} accent />
          <MonthStat value={hours ? `${hours}:${String(mins).padStart(2, '0')}` : String(mins)} label={hours ? tr('history.hours') : tn('history.minutes', mins)} />
          <MonthStat value={String(stats.cardio)} label={tr('history.cardio')} />
        </View>

        <View accessibilityLabel={tr('history.calendarAria', { month: L.fmtMonth(month) })} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {tr('history.weekInitials').split(' ').map((w, i) => (
            <View key={`w${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingBottom: 4 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Text style={{ fontFamily: font.bodyBold, fontSize: 11, letterSpacing: 1, color: color.muted }}>{w}</Text>
            </View>
          ))}
          {Array.from({ length: grid.lead }, (_, i) => <View key={`l${i}`} style={{ width: `${100 / 7}%` }} />)}
          {grid.days.map(d => (
            <DayCell key={d} date={d} today={d === t.today} future={d > t.today}
              trained={marks.trained.has(d)} cardio={marks.cardio.has(d)} selected={d === selected} onPress={() => pickDay(d)} />
          ))}
        </View>
      </View>

      {selected && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 4 }}>
          <Text variant="title" accessibilityRole="header" style={{ fontSize: 19, flexShrink: 1 }}>{L.fmtDate(selected)}</Text>
          <Button variant="ghost" size="sm" title={tr('history.showMonth')} onPress={() => setSelected(null)} />
        </View>
      )}

      {shown.length === 0 && (
        <Text variant="muted" style={{ textAlign: 'center', paddingVertical: 16, paddingHorizontal: 12 }}>
          {selected ? tr('history.emptyDay') : <>{tr('history.emptyMonth', { month: L.fmtMonth(month) })}{'\n'}{tr('history.emptyMonthHint')}</>}
        </Text>
      )}

      <View style={{ gap: 14 }}>
        {days.map(d => (
          <View key={d.date} style={{ gap: 6 }}>
            {!selected && <DayHeader date={d.date} />}
            <View style={{ backgroundColor: color.card, borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
              {d.items.map((f, i) => (
                <Fragment key={`${f.kind}-${f.id}`}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 52 }} />}
                  <FeedRow t={t} f={f} />
                </Fragment>
              ))}
            </View>
          </View>
        ))}
      </View>

      <Button variant="ghost" icon="plus" block title={tr('history.addCardio')}
        onPress={() => addCardio(selected ?? (month === thisMonth ? t.today : `${month}-01`))} />
    </View>
  )
}

function MonthStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text variant="num" style={{ fontSize: 38, lineHeight: 36, color: accent ? color.accent : color.text }}>{value}</Text>
      <Text style={{ fontFamily: font.bodySemi, fontSize: 11.5, letterSpacing: 0.9, textTransform: 'uppercase', color: color.muted }}>{label}</Text>
    </View>
  )
}

function DayCell({ date, today, future, trained, cardio, selected, onPress }: {
  date: string; today: boolean; future: boolean; trained: boolean; cardio: boolean; selected: boolean; onPress: () => void
}) {
  const label = [L.fmtDate(date), trained && tr('history.training'), cardio && tr('history.cardio')].filter(Boolean).join(', ')
  return (
    <View style={{ width: `${100 / 7}%`, padding: 2.5 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: future, selected }} disabled={future}
        onPress={() => { platform().signals.haptic('tap'); onPress() }}
        style={({ pressed }) => ({
          aspectRatio: 1, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center',
          backgroundColor: future ? 'transparent' : trained ? color.accent : 'rgba(255,255,255,0.04)',
          borderWidth: today ? 2 : future ? 0 : 1,
          borderColor: today ? (trained ? color.onAccent : color.text) : trained ? 'transparent' : 'rgba(255,255,255,0.06)',
          // ausgewählter Tag: Volt-Ring außen (auch auf Trainingstagen sichtbar)
          boxShadow: selected ? `0 0 0 2px ${color.bg}, 0 0 0 4px ${color.accent}` : today && trained ? `0 0 0 2px ${color.accent}` : trained ? '0 4px 12px rgba(212, 255, 58, 0.18)' : undefined,
          opacity: future ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}>
        <Text style={{ fontFamily: trained ? font.display : font.displaySemi, fontSize: 17, lineHeight: 19, fontVariant: ['tabular-nums'], color: trained ? color.onAccent : color.muted }}>
          {Number(date.slice(8))}
        </Text>
        {cardio && <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: trained ? color.onAccent : color.accent }} />}
      </Pressable>
    </View>
  )
}

/** Überschrift einer Tagesgruppe: Wochentag und Datum */
function DayHeader({ date }: { date: string }) {
  const day = new Date(`${date}T12:00`)
  const weekday = day.toLocaleDateString(intl(), { weekday: 'long' })
  return (
    <Text accessibilityRole="header" style={{ fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: color.muted, paddingLeft: 4 }}>
      {weekday} · {day.toLocaleDateString(intl(), { day: 'numeric', month: 'numeric' })}
    </Text>
  )
}

/** Eintrag im Feed (kompakt, in der Tageskarte): Symbol, Titel, Kennzahlen, Chevron. Lange drücken: Kontextmenü. */
function FeedRow({ t, f }: { t: Training; f: FeedItem }) {
  const item: DayItem = { kind: f.kind, id: f.id }
  let title: string, meta: string, note = false
  if (f.kind === 'activity') {
    title = L.activityTitle(f.a)
    meta = L.fmtActivity(f.a) || tr('history.cardio')
  } else {
    const w = t.ix.workouts.get(f.s.workout)
    const reps = f.s.sets.reduce((n, x) => n + (t.ix.exercises.get(x.exercise)?.unit === 'reps' ? x.value : 0), 0)
    title = w ? w.focus : f.s.workout
    meta = [w?.name, f.s.durationSec ? L.fmtDuration(f.s.durationSec) : null, tn('history.sets', f.s.sets.length), reps ? tr('history.reps', { n: reps }) : null].filter(Boolean).join(' · ')
    note = !!f.s.note
  }
  const label = [L.fmtDate(f.date), title, meta, note ? tr('history.withNote') : null].filter(Boolean).join(', ')
  const remove = () => f.kind === 'activity' ? void confirmRemoveActivity(t, f.a) : void confirmRemoveSession(t, f.s)

  return (
    <Link href={dayHref(item)} asChild onPress={() => platform().signals.haptic('tap')}>
      <Link.Trigger>
        <Pressable accessibilityRole="button" accessibilityLabel={label}
          // fester Style: Link.Trigger (asChild) reicht keine Style-Funktion durch
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingVertical: 9, paddingHorizontal: 14 }}>
          <View style={{ width: 26, alignItems: 'center' }}>
            <Icon name={f.kind === 'session' ? 'training' : f.a.kind === 'ride' ? 'bike' : f.a.kind === 'run' ? 'run' : 'flame'} size={18}
              color={f.kind === 'session' ? color.accent : color.text} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <Text variant="title" numberOfLines={1} style={{ fontSize: 17, lineHeight: 19 }}>{title}</Text>
            <Text variant="small" numberOfLines={1}>{meta}</Text>
          </View>
          {note && <Icon name="note" size={15} color={color.accent} />}
          <Icon name="right" size={14} color={color.muted} />
        </Pressable>
      </Link.Trigger>
      <Link.Menu>
        {f.kind === 'activity'
          ? <Link.MenuAction icon="pencil" onPress={() => router.push({ pathname: '/activity', params: { date: f.date, id: f.id } })}>{tr('history.editActivity')}</Link.MenuAction>
          : null}
        <Link.MenuAction icon="trash" destructive onPress={remove}>
          {f.kind === 'activity' ? tr('history.deleteActivity') : tr('history.deleteSession')}
        </Link.MenuAction>
      </Link.Menu>
    </Link>
  )
}
