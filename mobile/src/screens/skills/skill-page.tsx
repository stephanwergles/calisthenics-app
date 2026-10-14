/* Skill-Seite (Push im Skills-Tab): Stand als Ring, Ziel setzen/entfernen, der Weg zum Skill
   (Ziel-Progressionen mit Clip), unterstützende Progressionen, Voraussetzungen. Eine Progression
   öffnet ihre Leiter als Modal. (Web: SkillsView.tsx – SkillDetail) */
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, t as tr } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { ask, Button, Card, color, ExerciseMedia, ExerciseStill, font, hasClip, Icon, Ring, SectionTitle, SheetScreen, Text } from '@/ui'
import { platform } from '@lever/core/platform.ts'
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
  const row = (pid: string) => ({ pid, name: L.progressionName(t.ix, pid), ...stepLine(t, pid) })
  const targets = sk.targets.filter(pid => t.ix.progressions.has(pid)).map(row)
  const support = sk.support.filter(pid => t.ix.progressions.has(pid)).map(row)
  const prereqs = sk.prerequisites.filter(x => t.ix.progressions.has(x.progression)).map(x => {
    const steps = t.ix.progressions.get(x.progression)!.steps
    const done = L.currentStep(t.ix, t.state, x.progression).index >= x.minStep
    const name = t.ix.exercises.get(steps[Math.min(x.minStep, steps.length - 1)].exercise)?.name ?? x.progression
    return { pid: x.progression, name, done, now: stepLine(t, x.progression).step.exercise.name }
  })
  const blocked = full && !card.goal
  // schon gekonnt (z. B. Dips mit Gewicht): Ziel-Leitern direkt auf die letzte Stufe, nach Rückfrage
  const markReached = async () => {
    const ok = await ask({
      title: tr('skills.canDoTitle', { name: sk.name }),
      message: tr('skills.canDoMessage', { list: targets.map(x => x.name).join(', ') }),
      ok: tr('skills.canDoOk'),
    })
    if (!ok) return
    platform().signals.haptic('success')
    t.setState(st => L.withSkillReached(t.ix, st, sk))
  }
  const pct = Math.round(card.share * 100)

  return (
    <SheetScreen title={sk.name}>
      {/* Stand und Ziel */}
      <Card active={card.goal} style={{ gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          accessible accessibilityLabel={card.reached ? tr('skills.reachedTitle') : `${tr('skills.percentLabel', { n: pct })}, ${card.stage}, ${card.current}`}>
          <Ring size={78} stroke={6} progress={card.reached ? 1 : card.share}>
            {card.reached
              ? <Icon name="check" size={26} color={color.accent} weight="bold" />
              : <Text style={{ fontFamily: font.display, fontSize: 21, color: color.text }}>{tr('skills.percent', { n: pct })}</Text>}
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="eyebrow">{card.reached ? tr('skills.reachedTitle') : card.stage}{card.goal ? tr('skills.yourGoal') : ''}</Text>
            {!card.reached && <Text variant="title" style={{ fontSize: 21 }}>{card.current}</Text>}
            {!card.reached && card.missing.length > 0 && <Text variant="small">{tr('skills.missing', { list: card.missing.join(', ') })}</Text>}
          </View>
        </View>
        <Button variant={card.goal ? 'secondary' : 'primary'} icon={card.goal ? 'minus' : blocked ? undefined : 'target'} disabled={blocked}
          title={card.goal ? tr('skills.removeGoal') : blocked ? tr('skills.goalsFull') : tr('skills.setGoal')}
          onPress={() => toggle(sk.id, !card.goal)} />
        {!card.reached && <Button variant="ghost" icon="checkCircle" title={tr('skills.canDo')} onPress={() => void markReached()} />}
      </Card>

      {/* Weg zum Skill: Ziel-Progressionen mit Clip der aktuellen Stufe */}
      <SectionTitle title={tr('skills.path')} />
      <View style={{ gap: 12 }}>
        {targets.map(x => (
          <Card key={x.pid} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
            {hasClip(x.step.exercise.id) && <ExerciseMedia exercise={x.step.exercise} style={{ height: 210, borderRadius: 0 }} />}
            <Pressable accessibilityRole="button" accessibilityLabel={`${x.name}, ${x.sub}`} onPress={() => openLadder(x.pid)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
              {!hasClip(x.step.exercise.id) && <ExerciseStill exercise={x.step.exercise} size={22} style={{ width: 56, height: 56, borderRadius: 12, borderCurve: 'continuous' }} />}
              <View style={{ flex: 1, gap: 3 }}>
                <Text variant="title" style={{ fontSize: 21 }}>{x.name}</Text>
                <Text variant="small">{x.sub}</Text>
              </View>
              <Icon name="right" size={13} color={color.muted} />
            </Pressable>
          </Card>
        ))}
      </View>

      {support.length > 0 && (
        <>
          <SectionTitle title={tr('skills.supportedBy')} />
          <Group inset={78}>
            {support.map(x => <ProgressionRow key={x.pid} pid={x.pid} name={x.name} sub={x.sub} exercise={x.step.exercise} />)}
          </Group>
        </>
      )}

      {prereqs.length > 0 && (
        <>
          <SectionTitle title={tr('skills.prerequisites')} />
          <Group inset={50}>
            {prereqs.map(x => (
              // antippbar: öffnet die Leiter der Voraussetzung (was ist das, wo stehe ich)
              <Pressable key={x.pid} accessibilityRole="button"
                accessibilityLabel={`${tr(x.done ? 'skills.prereqDone' : 'skills.prereqMissing', { name: x.name })}${x.done ? '' : `, ${tr('skills.prereqNow', { name: x.now })}`}`}
                onPress={() => openLadder(x.pid)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, minHeight: 56, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
                <View style={{ width: 22, alignItems: 'center' }}>
                  <Icon name={x.done ? 'checkCircle' : 'circle'} size={20} color={x.done ? color.accent : color.muted} />
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
    </SheetScreen>
  )
}
