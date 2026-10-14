/* Skills-Tab: deine Ziele, der realistischste nächste Skill, alle Skills als kompakte Liste mit
   Filter nach Körperregion, ganz unten die Grundlagen (Progressionen ohne Skill).
   (Web: src/client/components/SkillsView.tsx – SkillsView, Goals) */
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Link, router, type Href } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import { useApp } from '@/state/app'
import { TabHeader } from '@/navigation'
import { Button, Card, color, font, GUTTER, Icon, SectionTitle, Segmented, space, Text } from '@/ui'
import { Group, stepLine, useGoalToggle } from './shared'
import { GoalCard, ProgressionRow, SkillRow } from './rows'

type Filter = 'all' | 'pull' | 'push' | 'core' | 'legs'
const FILTERS: Filter[] = ['all', 'pull', 'push', 'core', 'legs']

export function SkillsTab() {
  const { t } = useApp()
  const locale = getLocale()
  const data = catalogData(t.ix.catalog)
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, locale])
  const cards = useMemo(() => L.skillOverview(t.ix, t.state, t.sessions, data.skills, data.meta), [t.ix, t.state, t.sessions, data, locale])
  const { full, toggle } = useGoalToggle(t)
  const [filter, setFilter] = useState<Filter>('all')
  const shown = cards.filter(c => filter === 'all' || c.region === filter)
  const inSkill = new Set(data.skills.flatMap(sk => [...sk.targets, ...sk.support]))
  const basics = tree.filter(p => !inSkill.has(p.pid))
  const started = cards.filter(c => c.started).length
  const syncError = !!t.sync.account && t.sync.phase === 'error'

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 40, gap: space.md }}>
        <View style={{ gap: 6, marginBottom: space.sm }}>
          <Text variant="small" style={{ fontFamily: font.bodySemi, textTransform: 'uppercase', letterSpacing: 1.6 }}>{tr('skills.count', { n: cards.length, started })}</Text>
        </View>

        <Goals />

        <SectionTitle title={tr('skills.allSkills')} />
        <Segmented label={tr('skills.region')} value={filter} onChange={setFilter}
          options={FILTERS.map(id => ({ id, title: id === 'all' ? tr('skills.all') : L.regionLabel(id) }))} />
        <Group>
          {shown.map(c => <SkillRow key={c.skill.id} card={c} full={full} onToggleGoal={on => toggle(c.skill.id, on)} />)}
        </Group>

        {basics.length > 0 && (
          <>
            <SectionTitle title={tr('skills.basics')} style={{ marginBottom: 0 }} />
            <Text variant="muted">{tr('skills.basicsHint')}</Text>
            <Group>
              {basics.map(p => <ProgressionRow key={p.pid} pid={p.pid} name={L.progressionName(t.ix, p.pid)} sub={stepLine(t, p.pid).sub} />)}
            </Group>
          </>
        )}
      </ScrollView>
      <TabHeader title={tr('skills.title')} syncError={syncError} />
    </>
  )
}

/** Ziele (bis zu drei Skills) mit Fortschritt, darunter der realistischste nächste Skill */
function Goals() {
  const { t } = useApp()
  const { goals: ids, full, toggle } = useGoalToggle(t)
  const { skills, meta } = catalogData(t.ix.catalog)
  const goals = ids.flatMap(id => {
    const skill = skills.find(s => s.id === id)
    return skill ? [{ skill, p: L.goalProgress(t.ix, t.state, t.sessions, skill) }] : []
  })
  // nächster Skill: nicht erreicht, kein Ziel und nicht schon in einem Ziel enthalten (z. B. Klimmzüge mit Gewicht im Muscle-up)
  const next = L.skillChoices(t.ix, t.state, skills, meta).find(c => !c.reached && !ids.includes(c.skill) && !c.partOf.some(g => ids.includes(g)))
  const edit = () => router.push('/profile/goals')
  return (
    <>
      <SectionTitle title={tr('skills.yourGoals')}
        right={<Button size="sm" variant="ghost" icon={goals.length ? 'edit' : 'plus'} title={goals.length ? tr('skills.change') : tr('skills.choose')} onPress={edit} />} />
      {goals.length ? (
        <View style={{ gap: 10 }}>
          {goals.map(({ skill, p }) => (
            <GoalCard key={skill.id} id={skill.id} name={skill.name} share={p.share} stage={p.stage} current={p.current} onRemove={() => toggle(skill.id, false)} />
          ))}
        </View>
      ) : <Text variant="muted">{tr('skills.goalsHint')}</Text>}

      {next && (
        <Card style={{ gap: 12, marginTop: space.sm }}>
          <Link href={{ pathname: '/skill/[id]', params: { id: next.skill } }} asChild onPress={() => platform().signals.haptic('tap')}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${tr('skills.nextUp')}: ${next.name}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="eyebrow">{tr('skills.nextUp')}</Text>
                <Text variant="display" style={{ fontSize: 28 }}>{next.name}</Text>
                <Text variant="muted">{next.missing.length ? tr('skills.nextMissing', { list: next.missing.join(', ') }) : tr(`profile.goals.tier.${next.tier}`)}</Text>
              </View>
              <Icon name="right" size={13} color={color.muted} />
            </Pressable>
          </Link>
          <Button variant="primary" icon={full ? undefined : 'target'} disabled={full} onPress={() => toggle(next.skill, true)}
            title={full ? tr('skills.goalsFull') : tr('skills.setGoal')} />
        </Card>
      )}
    </>
  )
}
