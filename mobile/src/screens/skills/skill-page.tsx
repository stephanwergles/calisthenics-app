/* Skill-Seite (Push im Skills-Tab). Aufbau von außen nach innen, damit klar bleibt, was sich
   worauf bezieht:
   1. der Skill selbst – Name, ein Satz, Ziel-Aktionen (Ziel wählen, „Kann ich schon“), Stand
   2. Voraussetzungen – was vorher sitzen muss
   3. „So lernst du ihn“ – die Stufen der Ziel-Leiter(n) als nummerierte Schritte, aktuelle markiert
   4. „Ergänzend trainieren“ – unterstützende Leitern, benannt nach ihrer aktuellen Übung
   Leitern, die schon Voraussetzung sind, erscheinen nicht noch einmal als Ergänzung. */
import { Fragment, useMemo } from 'react'
import { Pressable, View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import type { Exercise, Skill } from '@lever/domain/model.ts'
import { useApp } from '@/state/app'
import { ask, Button, Card, color, ExerciseMedia, font, hasClip, Icon, Ring, SectionTitle, SheetScreen, Text } from '@/ui'
import { blurb } from '@/screens/profile/shared'
import { Group, stepLine, useGoalToggle } from './shared'
import { openLadder, ProgressionRow } from './rows'

export function SkillPage({ id }: { id: string }) {
  const { t } = useApp()
  const locale = getLocale()
  const data = catalogData(t.ix.catalog)
  const card = useMemo(() => L.skillOverview(t.ix, t.state, t.sessions, data.skills, data.meta).find(c => c.skill.id === id),
    [t.ix, t.state, t.sessions, data, id, locale])
  const { full, toggle } = useGoalToggle(t)
  if (!card) return <SheetScreen title={tr('skills.notFound')} />

  const sk = card.skill
  const has = (pid: string) => t.ix.progressions.has(pid)
  const preIds = new Set(sk.prerequisites.map(p => p.progression))
  const ladders = sk.targets.filter(has).map(pid => ({ pid, label: ladderLabel(t, sk, pid), step: L.currentStep(t.ix, t.state, pid) }))
  const support = sk.support.filter(pid => has(pid) && !preIds.has(pid)).map(pid => ({ pid, ...stepLine(t, pid) }))
  const prereqs = sk.prerequisites.filter(x => has(x.progression)).map(x => {
    const steps = t.ix.progressions.get(x.progression)!.steps
    const done = L.currentStep(t.ix, t.state, x.progression).index >= x.minStep
    const need = steps[Math.min(x.minStep, steps.length - 1)].exercise
    const name = t.ix.exercises.get(need)?.name ?? x.progression
    return { pid: x.progression, need, name, done, now: stepLine(t, x.progression).step.exercise.name }
  })
  const blocked = full && !card.goal
  const pct = Math.round(card.share * 100)
  const single = ladders.length === 1 ? ladders[0].step : null
  // „Stufe 1 von 3“ bei einer Leiter, sonst Prozent über alle Ziel-Leitern
  const standTitle = card.reached ? tr('skills.reachedTitle') : single ? tr('skills.stageOf', { i: single.index + 1, n: single.total }) : tr('skills.percent', { n: pct })

  const markReached = async () => {
    const ok = await ask({
      title: tr('skills.canDoTitle', { name: sk.name }),
      message: tr('skills.canDoMessage', { list: ladders.map(x => L.progressionName(t.ix, x.pid)).join(', ') }),
      ok: tr('skills.canDoOk'),
    })
    if (!ok) return
    platform().signals.haptic('success')
    t.setState(st => L.withSkillReached(t.ix, st, sk))
  }

  return (
    <SheetScreen title={sk.name} sub={blurb(`profile.goals.blurb.${sk.id}`)}>
      {/* 1 · der Skill: Ziel-Aktionen direkt unter dem Namen, dann der Stand */}
      <View style={{ gap: 10 }}>
        <Button variant={card.goal ? 'secondary' : 'primary'} icon={card.goal ? 'minus' : blocked ? undefined : 'target'} disabled={blocked}
          title={card.goal ? tr('skills.removeGoal') : blocked ? tr('skills.goalsFull') : tr('skills.setGoal')}
          onPress={() => toggle(sk.id, !card.goal)} />
        {!card.reached && <Button variant="ghost" icon="checkCircle" title={tr('skills.canDo')} onPress={() => void markReached()} />}
      </View>
      <Card active={card.goal}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          accessible accessibilityLabel={`${tr('skills.yourStand')}: ${standTitle}${card.goal ? tr('skills.yourGoal') : ''}`}>
        <Ring size={64} stroke={5} progress={card.reached ? 1 : card.share}>
          {card.reached
            ? <Icon name="check" size={22} color={color.accent} weight="bold" />
            : <Text style={{ fontFamily: font.display, fontSize: 17, color: color.text }}>{tr('skills.percent', { n: pct })}</Text>}
        </Ring>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="eyebrow">{tr('skills.yourStand')}{card.goal ? tr('skills.yourGoal') : ''}</Text>
          <Text variant="title" style={{ fontSize: 22 }}>{standTitle}</Text>
          {!card.reached && single && <Text variant="small">{tr('skills.nowAt', { name: single.exercise.name })}</Text>}
        </View>
        </View>
      </Card>

      {/* 2 · Voraussetzungen */}
      {prereqs.length > 0 && (
        <>
          <SectionTitle title={tr('skills.prerequisites')} style={{ marginBottom: 0 }} />
          <Text variant="muted">{tr('skills.prereqHint')}</Text>
          <Group inset={50}>
            {prereqs.map(x => (
              <Pressable key={x.pid} accessibilityRole="button"
                accessibilityLabel={`${tr(x.done ? 'skills.prereqDone' : 'skills.prereqMissing', { name: x.name })}${x.done ? '' : `, ${tr('skills.prereqNow', { name: x.now })}`}`}
                onPress={() => openLadder(x.pid, x.need)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 56, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
                {/* Status, kein Bedienelement: erfüllt = Haken, offen = Schloss (wie in der Skill-Liste) */}
                <View style={{ width: 22, alignItems: 'center' }} accessibilityElementsHidden>
                  <Icon name={x.done ? 'checkCircle' : 'lock'} size={x.done ? 20 : 15} color={x.done ? color.accent : color.muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{x.name}</Text>
                  {!x.done && x.now !== x.name && <Text variant="small">{tr('skills.prereqNow', { name: x.now })}</Text>}
                </View>
                <Text variant="small" style={{ color: x.done ? color.accent : color.muted }}>{x.done ? tr('skills.prereqMet') : tr('skills.prereqOpen')}</Text>
                <Icon name="right" size={13} color={color.muted} />
              </Pressable>
            ))}
          </Group>
        </>
      )}

      {/* 3 · So lernst du ihn: Stufen als Schritte */}
      <SectionTitle title={tr('skills.path')} style={{ marginBottom: 0 }} />
      <Text variant="muted">{tr('skills.pathHint')}</Text>
      {ladders.map(x => <Steps key={x.pid} pid={x.pid} label={x.label} current={x.step.index} />)}

      {/* 4 · Ergänzend trainieren */}
      {support.length > 0 && (
        <>
          <SectionTitle title={tr('skills.supportedBy')} style={{ marginBottom: 0 }} />
          <Text variant="muted">{tr('skills.supportHint')}</Text>
          <Group inset={78}>
            {support.map(x => <ProgressionRow key={x.pid} pid={x.pid} name={x.step.exercise.name}
              sub={[L.progressionName(t.ix, x.pid), tr('logic.stage', { i: x.step.index + 1, n: x.step.total })].join(' · ')} exercise={x.step.exercise} />)}
          </Group>
        </>
      )}
    </SheetScreen>
  )
}

/** Name einer Ziel-Leiter ohne den Skill-Namen davor („Muscle-up · Zugkraft“ → „Zugkraft“);
    heißt sie wie der Skill selbst, braucht sie keine eigene Überschrift */
function ladderLabel(t: ReturnType<typeof useApp>['t'], sk: Skill, pid: string): string | undefined {
  const name = L.progressionName(t.ix, pid)
  if (name === sk.name) return undefined
  return name.startsWith(`${sk.name} · `) ? name.slice(sk.name.length + 3) : name
}

/** Stufen einer Leiter als nummerierte Schritte; die aktuelle zeigt oben ihren Clip. Tippen öffnet die Leiter. */
function Steps({ pid, label, current }: { pid: string; label?: string; current: number }) {
  const { t } = useApp()
  const steps = t.ix.progressions.get(pid)!.steps.map(s => ({ ex: t.ix.exercises.get(s.exercise) as Exercise, target: s.target }))
  const now = steps[current]
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      {label && <Text variant="eyebrow" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>{label}</Text>}
      {now && hasClip(now.ex.id) && <ExerciseMedia exercise={now.ex} style={{ height: 200, borderRadius: 0 }} />}
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'next'
        return (
          <Fragment key={s.ex.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 62 }} />}
            <Pressable accessibilityRole="button" onPress={() => openLadder(pid, s.ex.id)}
              accessibilityLabel={tr('skills.stepA11y', { i: i + 1, name: s.ex.name, state: tr(`skills.stepState.${state}`) })}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 58,
                backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : state === 'now' ? color.accentDim : 'transparent' })}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                backgroundColor: state === 'done' ? color.accent : 'transparent',
                borderWidth: state === 'done' ? 0 : state === 'now' ? 2 : 1, borderColor: state === 'now' ? color.accent : color.line,
              }}>
                {state === 'done'
                  ? <Icon name="check" size={15} color={color.onAccent} weight="bold" />
                  : <Text style={{ fontFamily: font.display, fontSize: 15, color: state === 'now' ? color.accent : color.muted }}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {state === 'now' && <Text variant="eyebrow" style={{ fontSize: 11, letterSpacing: 1.2 }}>{tr('skills.stepState.now')}</Text>}
                <Text variant="label" style={{ color: state === 'next' ? color.muted : color.text }}>{s.ex.name}</Text>
                <Text variant="small">{s.target.label}</Text>
              </View>
              <Icon name="right" size={13} color={color.muted} />
            </Pressable>
          </Fragment>
        )
      })}
    </Card>
  )
}
