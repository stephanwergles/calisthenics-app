/* Skills-Tab: deine Ziele, Vorschläge mit Begründung, alle Skills als kompakte Liste mit
   Filter nach Körperregion, ganz unten die Grundlagen (Progressionen ohne Skill).
   (Web: src/client/components/SkillsView.tsx – SkillsView, Goals) */
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, t as tr } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import { useApp } from '@/state/app'
import { TabHeader } from '@/navigation'
import { color, font, GUTTER, Icon, SectionTitle, Segmented, space, Text } from '@/ui'
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

/** Ziele (bis zu fünf Skills) mit Fortschritt, darunter Vorschläge mit konkreter Begründung.
    Ziele setzt man auf der Skill-Seite oder direkt hier – eine eigene Auswahlseite gibt es nur im Onboarding. */
function Goals() {
  const { t } = useApp()
  const { goals: ids, full, toggle } = useGoalToggle(t)
  const { skills, meta } = catalogData(t.ix.catalog)
  const goals = ids.flatMap(id => {
    const skill = skills.find(s => s.id === id)
    return skill ? [{ skill, p: L.goalProgress(t.ix, t.state, t.sessions, skill) }] : []
  })
  const ideas = L.goalIdeas(t.ix, t.state, skills, meta)
  return (
    <>
      <SectionTitle title={tr('skills.yourGoals')} />
      {goals.length > 0 && (
        <View style={{ gap: 10 }}>
          {goals.map(({ skill, p }) => (
            <GoalCard key={skill.id} id={skill.id} name={skill.name} share={p.share} stage={p.stage} current={p.current} onRemove={() => toggle(skill.id, false)} />
          ))}
        </View>
      )}
      <Text variant="muted">{goals.length ? tr('skills.goalsHowTo') : tr('skills.goalsHint')}</Text>

      {ideas.length > 0 && (
        <>
          <SectionTitle title={tr('skills.ideas')} style={{ marginBottom: 0 }} />
          <Text variant="muted">{tr('skills.ideasHint')}</Text>
          <Group>
            {ideas.map(x => <IdeaRow key={x.skill} idea={x} full={full} onAdd={() => toggle(x.skill, true)} />)}
          </Group>
        </>
      )}
    </>
  )
}

/** Vorschlag: Einstufung, Name, Begründung – Tippen öffnet die Skill-Seite, rechts direkt als Ziel */
function IdeaRow({ idea, full, onAdd }: { idea: L.GoalIdea; full: boolean; onAdd: () => void }) {
  const tier = tr(`profile.goals.tier.${idea.tier}`)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${idea.name}, ${tier}, ${idea.reason}`}
        onPress={() => { platform().signals.haptic('tap'); router.push({ pathname: '/skill/[id]', params: { id: idea.skill } }) }}
        style={({ pressed }) => ({ flex: 1, gap: 3, paddingVertical: 13, paddingLeft: 16, paddingRight: 8, minHeight: 64, backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent' })}>
        <Text variant="eyebrow" style={{ fontSize: 11, letterSpacing: 1.2, color: idea.tier === 'next' ? color.accent : color.muted }}>{tier}</Text>
        <Text variant="title" style={{ fontSize: 20, lineHeight: 22 }}>{idea.name}</Text>
        <Text variant="small">{idea.reason}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={full ? tr('skills.goalsFull') : tr('skills.addGoal', { name: idea.name })}
        accessibilityState={{ disabled: full }} disabled={full} onPress={onAdd} hitSlop={4}
        style={({ pressed }) => ({ width: 44, height: 44, marginRight: 12, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: full ? color.line : color.accentLine, opacity: full ? 0.4 : 1, backgroundColor: pressed ? 'rgba(212,255,58,0.12)' : 'transparent' })}>
        <Icon name="plus" size={18} color={full ? color.muted : color.accent} />
      </Pressable>
    </View>
  )
}
