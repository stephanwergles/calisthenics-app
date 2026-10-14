/* Ziele: Skills als Kacheln mit Bild, Ein-Satz-Erklärung und Stand, nach Körperbereich gruppiert
   („realistisch als Nächstes“ zuerst). Erreichte Skills stehen in einer eigenen Gruppe am Ende und
   sind kein Ziel mehr. Baut ein Skill auf einem anderen auf („nach Muscle-up“) oder steckt er in
   einem gewählten Ziel („steckt schon in Muscle-up“), sagt die Kachel das. (Web: GoalPicker) */
import { View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import type { Training } from '@lever/core/useTraining.ts'
import type { Exercise, Region } from '@lever/domain/model.ts'
import type { SkillSuggestion } from '@lever/domain/assessment.ts'
import { hasClip, SectionTitle, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { NextFooter, Tiles, type Tile } from './parts'
import { blurb, useProfile, type Next } from './shared'

/** Bild eines Skills: die schwerste Stufe seiner Ziel-Leitern mit Clip (sonst die letzte) */
function skillExercise(ix: Training['ix'], targets: string[]): Exercise | undefined {
  const steps = targets.flatMap(pid => ix.progressions.get(pid)?.steps ?? [])
  const withClip = [...steps].reverse().find(st => hasClip(st.exercise))
  return ix.exercises.get((withClip ?? steps[steps.length - 1])?.exercise ?? '')
}
const REGION_ORDER = ['pull', 'push', 'legs', 'core']

export function GoalsPage({ next }: { next?: Next }) {
  const { t } = useApp()
  const { profile, change } = useProfile(t)
  const data = catalogData(t.ix.catalog)
  const choices = L.skillChoices(t.ix, t.state, data.skills, data.meta)
  const nameOf = (id: string) => choices.find(c => c.skill === id)?.name ?? data.skills.find(s => s.id === id)?.name ?? id
  const detail = (c: SkillSuggestion) => {
    if (c.reached) return tr('profile.goals.reached')
    const inGoal = c.partOf.find(g => profile.goals.includes(g))
    if (inGoal && !profile.goals.includes(c.skill)) return tr('profile.goals.partOf', { name: nameOf(inGoal) })
    if (c.after) return tr('profile.goals.after', { name: nameOf(c.after) })
    if (c.missing.length) return tr('profile.goals.missing', { list: c.missing.join(', ') })
    return tr(`profile.goals.tier.${c.tier}`)
  }
  const tiles = choices.map((c): Tile & { region: string; reached: boolean } => {
    const skill = data.skills.find(x => x.id === c.skill)!
    const on = profile.goals.includes(c.skill)
    return {
      id: c.skill, title: c.name, subtitle: blurb(`profile.goals.blurb.${c.skill}`), detail: detail(c),
      accent: !c.reached && c.tier === 'next' && !c.after, exercise: skillExercise(t.ix, skill.targets), on,
      // erreichte Skills sind kein Ziel mehr – nur abwählen, falls noch gewählt
      locked: c.reached && !on,
      region: t.ix.progressions.get(skill.targets[0])?.region ?? 'core', reached: c.reached,
    }
  })
  const open = tiles.filter(x => !x.reached || x.on)
  const reached = tiles.filter(x => x.reached && !x.on)
  const groups = [...new Set([...REGION_ORDER, ...open.map(x => x.region)])]
    .map(r => ({ region: r, items: open.filter(x => x.region === r) })).filter(g => g.items.length)
  const toggle = (id: string, on: boolean) => {
    if (on && profile.goals.length >= L.MAX_GOALS) { toast(tr('profile.goals.full')); return }
    change(p => L.withGoal(p, id, on))
  }
  return (
    <SheetScreen title={tr('profile.row.goals')} sub={tr('profile.goals.sub', { n: profile.goals.length })}
      footer={next ? <NextFooter next={next} /> : undefined}>
      <Text variant="muted">{tr('profile.goals.pickHint')}</Text>
      {groups.map(g => (
        <View key={g.region}>
          <SectionTitle title={L.regionLabel(g.region as Region)} />
          <Tiles items={g.items} onToggle={toggle} />
        </View>
      ))}
      {reached.length > 0 && (
        <View>
          <SectionTitle title={tr('profile.goals.reachedGroup')} />
          <Text variant="small" style={{ marginBottom: 10 }}>{tr('profile.goals.reachedHint')}</Text>
          <Tiles items={reached} onToggle={() => undefined} />
        </View>
      )}
    </SheetScreen>
  )
}
