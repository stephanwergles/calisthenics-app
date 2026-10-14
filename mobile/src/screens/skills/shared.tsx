/* Bausteine des Skills-Bereichs: Profil-Zugriff, Fortschrittsbalken, gruppierte Liste mit
   Trennlinien (eine Karte, Zeilen antippbar) und der Stufenwechsel der Leiter (wie im Web). */
import { Children, Fragment, isValidElement } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import * as L from '@lever/core/logic.ts'
import type { Training } from '@lever/core/useTraining.ts'
import type { Profile } from '@lever/domain/model.ts'
import { platform } from '@lever/core/platform.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { ask, color, radius } from '@/ui'

/** Profil lesen und ändern (Ziele) – wie useProfile im Web */
export function useProfile(t: Training) {
  const profile = L.profileOf(t.ix, t.state)
  const change = (fn: (p: Profile) => Profile) => t.setState(st => ({ ...st, profile: fn(L.profileOf(t.ix, st)) }))
  return { profile, change }
}

/** Ziel an/aus mit Haptik; voll (drei Ziele) → nichts */
export function useGoalToggle(t: Training) {
  const { profile, change } = useProfile(t)
  const full = profile.goals.length >= L.MAX_GOALS
  const toggle = (id: string, on: boolean) => {
    if (on && full && !profile.goals.includes(id)) return
    platform().signals.haptic('success')
    change(p => L.withGoal(p, id, on))
  }
  return { goals: profile.goals, full, toggle }
}

/** Dünner Fortschrittsbalken (statisch, kein Bedienelement) */
export function Bar({ share, width, style }: { share: number; width?: number; style?: StyleProp<ViewStyle> }) {
  const pct = Math.max(0, Math.min(1, share))
  return (
    <View style={[{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden', width }, style]} accessibilityElementsHidden>
      {pct > 0 && <View style={{ width: `${Math.max(4, pct * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: color.accent }} />}
    </View>
  )
}

/** Eine Karte mit Zeilen und Haarlinien dazwischen (Zeilen bringen ihren Druckzustand selbst mit) */
export function Group({ children, inset = 16 }: { children: React.ReactNode; inset?: number }) {
  const items = Children.toArray(children).filter(isValidElement)
  if (!items.length) return null
  return (
    <View style={{ backgroundColor: color.card, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: color.line, overflow: 'hidden' }}>
      {items.map((c, i) => (
        <Fragment key={c.key ?? i}>
          {i > 0 && <View style={{ height: 0.5, backgroundColor: color.line, marginLeft: inset }} />}
          {c}
        </Fragment>
      ))}
    </View>
  )
}

/** Stufe wechseln: unlock (Kriterium erfüllt), force (vorzeitig, mit Rückfrage), back (eine Stufe zurück) */
export async function switchStep(t: Training, p: L.SkillPath, action: 'unlock' | 'force' | 'back') {
  const to = action === 'back' ? p.step.prev : p.step.next
  if (!to) return
  if (action === 'force') {
    const at = p.step.target.unlockAt, done = p.progress?.done ?? 0
    const ok = await ask({
      title: tr('skills.forceTitle', { name: to.name }),
      message: at == null ? tr('skills.forceNoCriterion')
        : tr('skills.forceNotMet', { done, at, unit: p.step.exercise.unit === 'seconds' ? ' s' : '' }),
      ok: tr('skills.switch'),
    })
    if (!ok) return
  }
  platform().signals.haptic(action === 'back' ? 'tap' : 'success')
  t.setState(st => ({ ...st, current: { ...st.current, [p.pid]: to.id } }))
}

/** Untertitel einer Progression: aktuelle Übung, bei mehreren Stufen mit „Stufe i/n“ */
export function stepLine(t: Training, pid: string) {
  const step = L.currentStep(t.ix, t.state, pid)
  return { step, sub: step.total === 1 ? step.exercise.name : `${step.exercise.name} · ${tr('logic.stage', { i: step.index + 1, n: step.total })}` }
}
