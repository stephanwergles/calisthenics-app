/* Progressions-Leiter (Modal, auch vom Heute-Screen): oben die aktuelle Stufe mit Clip,
   Vorgabe, Kernpunkten und dem Freischalt-Kriterium samt Aktionen; darunter alle Stufen als
   Zeitleiste (erledigt / aktuell / gesperrt); ganz unten eine Stufe zurück.
   (Web: SkillsView.tsx – SkillSheet, Ladder, ladderBlocks) */
import { useMemo } from 'react'
import { View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { getLocale, t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, Card, color, ExerciseMedia, ExerciseStill, font, hasStill, Icon, SectionTitle, SheetScreen, Text } from '@/ui'
import { switchStep } from './shared'

export function Ladder({ pid }: { pid: string }) {
  const { t } = useApp()
  const locale = getLocale()
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, locale])
  const p = tree.find(x => x.pid === pid)
  if (!p) return <SheetScreen title={tr('skills.notFound')} />

  const region = p.region ? L.regionLabel(p.region) : p.workout?.name ?? ''
  const stage = tr('logic.stage', { i: p.step.index + 1, n: p.step.total })
  const sub = `${[region, L.BLOCK_LABEL[p.block], stage].filter(Boolean).join(' · ')}${p.paused ? tr('skills.paused') : ''}`
  const standing = L.stepStanding(t.sessions, p.step.exercise, p.step.target, p.step.nextTarget)
  const act = (a: 'unlock' | 'force' | 'back') => void switchStep(t, p, a)
  const ex = p.step.exercise
  const cues = ex.cues ?? []

  return (
    // Kopf nennt das Ziel der Leiter (letzte Stufe), nicht die aktuelle Übung – so sieht man, wohin es geht
    <SheetScreen title={L.progressionName(t.ix, p.pid)} sub={sub}>
      {/* aktuelle Stufe */}
      <Card active style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <ExerciseMedia exercise={ex} label={ex.name} style={{ height: 230, borderRadius: 0 }} />
        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text variant="eyebrow">{tr('skills.currentStep')} · {stage}</Text>
            <Text variant="display" style={{ fontSize: 28, lineHeight: 28 }}>{ex.name}</Text>
            <Text variant="muted">{p.step.target.label}{standing.best ? tr('skills.bestSession', { best: standing.best }) : ''}</Text>
          </View>

          {cues.length > 0 && (
            <View style={{ gap: 8 }} accessibilityLabel={tr('skills.cuesLabel')}>
              <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('skills.cuesFor', { name: ex.name })}</Text>
              {cues.map(c => (
                <View key={c} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.accent, marginTop: 8 }} />
                  <Text variant="body" style={{ flex: 1 }}>{c}</Text>
                </View>
              ))}
            </View>
          )}

          <Unlock p={p} missing={standing.missing} onAct={act} />
        </View>
      </Card>

      {/* alle Stufen */}
      <SectionTitle title={tr('skills.stages')} />
      <View>
        {p.nodes.map((n, i) => <Node key={n.exercise.id} n={n} i={i} last={i === p.nodes.length - 1} best={standing.best} />)}
      </View>

      {p.step.prev && <Button variant="ghost" icon="undo" title={tr('skills.backTo', { name: p.step.prev.name })} onPress={() => act('back')} />}
    </SheetScreen>
  )
}

/** Kriterium zum Freischalten, Fortschritt (2 Einheiten) und die passende Aktion */
function Unlock({ p, missing, onAct }: { p: L.SkillPath; missing: string | null; onAct: (a: 'unlock' | 'force') => void }) {
  const next = p.step.next
  const at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const done = p.progress?.done ?? 0
  const ready = !p.paused && done === 2 && !!next
  const box = { gap: 10, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: color.line }
  if (!next) return (
    <View style={[box, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <Icon name="trophy" size={18} color={color.accent} />
      <Text variant="label" style={{ flex: 1 }}>{tr('skills.topStep')}</Text>
    </View>
  )
  if (at == null) return (
    <View style={box}>
      <Text variant="muted">{tr('skills.noCriterion')}</Text>
      <Button variant="secondary" icon="up" title={tr('skills.switchTo', { name: next.name })} onPress={() => onAct('force')} />
    </View>
  )
  return (
    <View style={box}>
      <Text variant="label">{tr('skills.unlockCriterion', { at, unit })}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={tr('skills.progressLabel', { n: done })}>
        {[1, 2].map(k => <View key={k} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: done >= k ? color.accent : 'rgba(255,255,255,0.09)' }} />)}
      </View>
      <Text variant="small" style={{ color: ready ? color.accent : color.muted }}>{tr('skills.progressOf', { n: done })}{missing ? ` · ${missing}` : tr('skills.ready')}</Text>
      {ready
        ? <Button variant="primary" icon="up" title={tr('skills.unlock', { name: next.name })} onPress={() => onAct('unlock')} />
        : <Button variant="secondary" icon="up" title={tr('skills.forceSwitch')} onPress={() => onAct('force')} />}
    </View>
  )
}

/** Stufe in der Zeitleiste: Punkt an der Linie, Standbild, Name, Stand */
function Node({ n, i, last, best }: { n: L.SkillNode; i: number; last: boolean; best: string | null }) {
  const sub = n.state === 'done' ? tn('skills.done', n.sessions)
    : n.state === 'current' ? tr('skills.current', { target: n.target.label, best: best ? tr('skills.bestSession', { best }) : '' })
    : last ? tr('skills.finalStep') : tr('skills.locked')
  const line = (on: boolean, show: boolean) => <View style={{ width: 2, flex: 1, backgroundColor: show ? (on ? color.chalk : color.line) : 'transparent' }} />
  const current = n.state === 'current', done = n.state === 'done'
  return (
    <View style={{ flexDirection: 'row', gap: 14, minHeight: 76 }} accessible
      accessibilityLabel={tr('skills.stepA11y', { i: i + 1, name: n.exercise.name, state: sub })}>
      <View style={{ width: 34, alignItems: 'center' }}>
        {line(done || current, i > 0)}
        <View style={{
          width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
          backgroundColor: done ? color.chalk : current ? color.accent : 'transparent',
          borderWidth: done || current ? 0 : 1.5, borderColor: color.line,
        }}>
          {done ? <Icon name="check" size={16} color={color.onAccent} weight="bold" />
            : current ? <Text style={{ fontFamily: font.display, fontSize: 17, color: color.onAccent }}>{i + 1}</Text>
            : <Icon name="lock" size={13} color={color.muted} />}
        </View>
        {line(done, !last)}
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
        {hasStill(n.exercise.id) && (
          <ExerciseStill exercise={n.exercise} style={{ width: 52, height: 52, borderRadius: 12, borderCurve: 'continuous', opacity: n.state === 'locked' ? 0.45 : 1 }} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" style={{ fontSize: 19, color: n.state === 'locked' ? color.muted : current ? color.accent : color.text }}>{n.exercise.name}</Text>
          <Text variant="small">{sub}</Text>
        </View>
      </View>
    </View>
  )
}
