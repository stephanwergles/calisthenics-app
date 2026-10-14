/* Heute: die Woche auf einen Blick, das Workout des Tages als große Karte, darunter die Skills
   mit dem kürzesten Weg zur nächsten Stufe. (Web: src/client/components/HomeView.tsx) */
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, intl, t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { WorkoutStrip } from '@/screens/plan/workout-strip'
import { dayHref } from '@/screens/log/params'
import { HeaderButton } from '@/navigation'
import { Button, Card, color, ExerciseStill, font, GUTTER, hasClip, Icon, type IconName, radius, Ring, SectionTitle, space, Text, Wordmark } from '@/ui'

export function Today() {
  const { t, slots, started, doneToday: done, start, openTraining } = useApp()
  const w = t.ix.workouts.get(t.workout)!
  const locale = getLocale()
  // ausgewählter Tag der Wochenleiste (wie im Log): zeigt ein Banner; heute = keins
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => setSel(null), [t.today])
  const week = useMemo(() => L.weekStrip(t.ix, t.sessions, t.activities, t.today), [t.ix, t.sessions, t.activities, t.today, locale])
  const streak = useMemo(() => L.streakWeeks(t.sessions, t.today, t.state.phases), [t.sessions, t.today, t.state.phases])
  const minutes = useMemo(() => L.estimateMinutes(t.sessions, t.workout), [t.sessions, t.workout])
  const skills = useMemo(() => L.nextSkills(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, locale])
  const resting = L.restingPhase(t.state, t.today)
  const blocked = slots.filter(s => s.blockedBy)
  const subs = slots.filter(s => s.substituteFor).length
  const notice = resting ? tr('home.noticeResting', { phase: L.fmtPhase(resting) })
    : blocked.length ? tn('home.noticeBlocked', blocked.length, { reasons: [...new Set(blocked.map(s => s.blockedBy))].join(', ') })
      + (subs ? (subs === blocked.length ? tr('home.noticeSubsAll') : tr('home.noticeSubsSome', { n: subs })) : '.')
    : L.reentry(t.state, t.today) ? tr('home.noticeReentry') : null

  const active = slots.filter(s => s.state !== 'paused' && s.state !== 'skipped')
  const sets = active.reduce((n, s) => n + s.planned, 0)
  const doneSets = active.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0)
  const [first, ...more] = w.focus.split(' · ')
  const hero = (active.find(s => hasClip(s.step.exercise.id)) ?? active[0])?.step.exercise
  const dateLabel = new Date(`${t.today}T12:00`).toLocaleDateString(intl(), { weekday: 'long', day: 'numeric', month: 'long' })
  const cta = t.active ? tr('home.ctaActive') : done ? tr('home.ctaAgain') : started ? tr('home.ctaResume') : tr('home.ctaStart')
  const onStart = t.active ? () => openTraining(undefined) : start
  const syncError = !!t.sync.account && t.sync.phase === 'error'

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 40, gap: space.lg }}>
        {/* Wortmarke auf Höhe des Profil-Buttons (in den transparenten Kopf hochgezogen), scrollt
            mit dem Inhalt weg – als Toolbar-Element war sie angeschnitten und blieb kleben */}
        <View style={{ marginTop: -44, height: 22, justifyContent: 'center', alignSelf: 'flex-start' }}><Wordmark height={20} /></View>
        {/* Kopf: Datum, Titel, Serie */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="small" style={{ fontFamily: font.bodySemi, textTransform: 'uppercase', letterSpacing: 1.6 }}>{dateLabel}</Text>
            <Text variant="hero" accessibilityRole="header">
              {done ? tr('home.titleDone') : t.active ? tr('home.titleActive') : tr('home.titleReady')}{'\n'}
              <Text variant="hero" style={{ color: color.accent }}>{done ? tr('home.titleDoneAccent') : `${first}.`}</Text>
            </Text>
          </View>
          {streak > 0 && (
            <View style={{ alignItems: 'flex-end' }} accessible accessibilityLabel={`${streak} ${tn('home.streak', streak)}`}>
              <Text variant="num" style={{ fontSize: 44, lineHeight: 44 }}>{streak}</Text>
              <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'right', maxWidth: 110 }}>{tn('home.streak', streak)}</Text>
            </View>
          )}
        </View>

        {/* Woche */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel={tr('home.weekAria')}>
          {week.map(d => {
            const selected = d.date === sel
            return (
            <Pressable key={d.date} accessibilityRole="button" accessibilityState={{ selected: selected || (!sel && d.today) }}
              onPress={() => setSel(cur => (d.today || cur === d.date ? null : d.date))}
              style={({ pressed }) => ({ alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
              accessibilityLabel={`${d.label}${d.trained ? tr('home.dayTrained') : d.planned ? tr('home.dayPlanned') : ''}${d.cardio ? tr('home.dayCardio') : ''}${d.today ? tr('home.dayToday') : ''}`}>
              <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', color: d.today || selected ? color.text : color.muted }}>{d.label}</Text>
              <View style={{
                width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
                backgroundColor: d.trained ? color.chalk : d.today ? color.accent : 'transparent',
                // jeder Tag ist antippbar: geplant = Volt-Ring, sonst dünner Rand (Fläche oder Rand = anfassbar)
                borderWidth: d.trained || d.today ? 0 : d.planned ? 2 : 1,
                borderColor: d.planned ? color.accent : color.line,
                // ausgewählt: weißer Ring außen
                boxShadow: selected ? `0 0 0 2px ${color.bg}, 0 0 0 4px ${color.text}` : undefined,
              }}>
                {d.trained ? <Icon name="check" size={16} color={color.onAccent} weight="bold" />
                  : <Text style={{ fontFamily: font.display, fontSize: 17, color: d.today ? color.onAccent : d.planned ? color.accent : color.muted }}>{Number(d.date.slice(8))}</Text>}
              </View>
              {d.cardio && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color.accent, marginTop: -2 }} />}
            </Pressable>
            )
          })}
        </View>
        {sel && <DayBanner date={sel} onClose={() => setSel(null)} />}

        {notice && <Text variant="muted" accessibilityLiveRegion="polite" style={{ color: color.text, backgroundColor: color.accentDim, padding: 12, borderRadius: 14, overflow: 'hidden' }}>{notice}</Text>}

        {/* Workout des Tages */}
        <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          {hero && <ExerciseStill exercise={hero} style={{ position: 'absolute', right: -10, top: 0, bottom: 0, width: '55%', opacity: 0.55 }} />}
          <View style={{ padding: 22, gap: 12 }}>
            <Text variant="eyebrow">{tr('home.heroLabel', { name: w.name })}{started ? tr('home.heroSets', { done: doneSets, total: sets }) : ''}</Text>
            <Text variant="display" style={{ fontSize: 44, lineHeight: 42 }}>{first}{more.length ? `\n${more.join(' · ')}` : ''}</Text>
            {!started && <Text variant="muted">{tn('home.meta.exercises', active.length)} · {tn('home.meta.sets', sets)}{minutes ? tr('home.metaMinutes', { n: minutes }) : ''}</Text>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {active.slice(0, 3).map(s => <Chip key={s.pid} text={s.step.exercise.name} />)}
              {active.length > 3 && <Chip text={`+${active.length - 3}`} muted />}
            </View>
            <View style={{ gap: 10, marginTop: 6 }}>
              {done && t.todaySession
                ? <Button variant="primary" size="lg" icon="trophy" title={tr('home.summary')} onPress={() => router.push({ pathname: '/summary/[id]', params: { id: t.todaySession!.id } })} />
                : <Button variant="primary" size="lg" icon="play" title={cta} onPress={onStart} />}
              {done && <Button icon="play" title={cta} onPress={onStart} />}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button style={{ flex: 1 }} variant="secondary" icon="list" title={tr('home.exercises')} onPress={() => router.push('/exercises')} />
                <Button style={{ flex: 1 }} variant="secondary" icon="swap" title={tr('home.swap')} onPress={() => router.push('/swap')} />
              </View>
            </View>
          </View>
        </Card>

        {/* Workouts: jedes Workout mit einem Tipp starten (auch außerhalb des Plan-Tags) */}
        <WorkoutStrip mode="home" />

        {/* Challenge: Einstieg in die Selbsttests, mit dem letzten Versuch */}
        <ChallengeCard />

        {/* Nächste Skills */}
        {skills.length > 0 && (
          <View>
            <SectionTitle title={tr('home.nextSkills')} right={<Button size="sm" variant="ghost" title={tr('home.allSkills')} icon="right" onPress={() => router.navigate('/skills')} />} />
            <View style={{ gap: 10 }}>
              {skills.map(s => {
                const pct = Math.round(s.readiness * 100)
                const prog = L.unlockProgress(t.sessions, s.step.exercise.id, s.step.target, s.step.nextTarget)
                const ready = !!prog && prog.done >= prog.needed
                return (
                  <Card key={s.pid} active={ready} onPress={() => router.push({ pathname: '/progression/[pid]', params: { pid: s.pid } })}
                    label={L.progressionName(t.ix, s.pid)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Ring size={52} stroke={5} progress={s.readiness}>
                      {ready ? <Icon name="check" size={20} color={color.accent} weight="bold" /> : <Text style={{ fontFamily: font.display, fontSize: 14, color: color.text }}>{pct}%</Text>}
                    </Ring>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="title" style={{ fontSize: 19 }}>{L.progressionName(t.ix, s.pid)}</Text>
                      <Text variant="small">{ready
                        ? tr('home.readyFor', { name: s.step.next!.name })
                        : tr('home.skillProgress', { exercise: s.step.exercise.name, stage: s.step.index + 1, total: s.step.total, done: prog?.done ?? 0 })}</Text>
                    </View>
                    {ready && <Button size="sm" variant="outline" title={tr('home.unlock')}
                      onPress={() => t.setState(st => ({ ...st, current: { ...st.current, [s.pid]: s.step.next!.id } }))} />}
                  </Card>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>
      {/* Kopf: Wortmarke links, Profil rechts – beides im nativen Header, der Inhalt beginnt direkt darunter */}
      <HeaderButton icon={syncError ? 'warning' : 'user'} label={tr('app.profileButton', { status: '' })} onPress={() => router.push('/profile')} />
    </>
  )
}

function Chip({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' }}>
      <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: muted ? color.muted : color.text }}>{text}</Text>
    </View>
  )
}

function ChallengeCard() {
  const { t } = useApp()
  const challenges = L.allChallenges(catalogData(t.ix.catalog).challenges, t.state)
  const last = t.activities.filter(a => a.kind === 'challenge').sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt ?? 0) - (a.updatedAt ?? 0)))[0]
  const lastC = last && challenges.find(c => c.id === last.challenge)
  return (
    <Card onPress={() => router.push('/challenges')} label={`${tr('challenge.cardTitle')}, ${tr('challenge.cardSub')}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="flame" size={22} color={color.accent} />
        <Text variant="title" style={{ flex: 1 }}>{tr('challenge.cardTitle')}</Text>
        <Icon name="right" size={14} color={color.muted} />
      </View>
      <Text variant="muted">{lastC && last.value !== undefined
        ? tr('challenge.cardBest', { name: lastC.name, value: L.fmtChallengeValue(lastC, last.value) })
        : tr('challenge.cardSub')}</Text>
    </Card>
  )
}


/** Banner zum ausgewählten Tag der Wochenleiste: erledigt, Cardio, geplant, verpasst oder Ruhetag –
    mit der passenden Aktion. Ruhetage laden zu lockerer Bewegung ein; der Wochenplan ändert sich hier nie. */
function DayBanner({ date, onClose }: { date: string; onClose: () => void }) {
  const { t } = useApp()
  const past = date < t.today
  const day = new Date(`${date}T12:00`).toLocaleDateString(intl(), { weekday: 'long', day: 'numeric', month: 'numeric' })
  const session = t.sessions.find(s => s.date === date && L.isTrained(s))
  const cardio = L.cardioOnly(t.activities).filter(a => a.date === date)
  const planned = t.ix.workouts.get(t.ix.catalog.weekplan[L.weekdayOf(date)] ?? '')
  const addCardio = { icon: 'plus' as const, title: tr('history.restAddCardio'), onPress: () => router.push({ pathname: '/activity', params: { date } }) }
  let label: string, title: string, text: string | null, action: { icon: IconName; title: string; onPress: () => void } | null
  if (session) {
    const w = t.ix.workouts.get(session.workout)
    label = tr('home.bannerDone'); title = w?.focus ?? session.workout
    text = [w?.name, session.durationSec ? L.fmtDuration(session.durationSec) : null, tn('history.sets', session.sets.length),
      ...cardio.map(a => L.activityTitle(a))].filter(Boolean).join(' · ')
    action = { icon: 'right', title: tr('home.bannerView'), onPress: () => router.push(dayHref({ kind: 'session', id: session.id })) }
  } else if (cardio.length) {
    label = tr('home.bannerCardio'); title = cardio.map(a => L.activityTitle(a)).join(' · ')
    text = cardio.map(a => L.fmtActivity(a)).filter(Boolean).join(' · ') || null
    action = { icon: 'right', title: tr('home.bannerView'), onPress: () => router.push(dayHref({ kind: 'activity', id: cardio[0].id })) }
  } else if (planned && !past) {
    label = tr('home.bannerPlanned'); title = planned.focus
    text = `${planned.name} · ${tn('home.meta.exercises', planned.slots.length)}`
    action = { icon: 'right', title: tr('home.bannerOverview'), onPress: () => router.push({ pathname: '/workouts/[id]', params: { id: planned.id } }) }
  } else if (planned) {
    label = tr('home.bannerMissed'); title = planned.focus; text = tr('history.restTextPast'); action = addCardio
  } else {
    label = tr('history.restDay'); title = tr('history.restTitle')
    text = past ? tr('history.restTextPast') : tr('history.restText'); action = past ? addCardio : null
  }
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: color.card, borderWidth: 1, borderColor: color.line, borderRadius: radius.card, borderCurve: 'continuous', padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="eyebrow" style={{ fontSize: 11 }}>{day} · {label}</Text>
          <Text variant="title" style={{ fontSize: 20, lineHeight: 22 }}>{title}</Text>
          {text ? <Text variant="small">{text}</Text> : null}
        </View>
        <Button size="sm" variant="ghost" icon="close" label={tr('common.close')} onPress={onClose} />
      </View>
      {action && <Button size="sm" icon={action.icon} title={action.title} onPress={action.onPress} style={{ alignSelf: 'flex-start' }} />}
    </View>
  )
}
