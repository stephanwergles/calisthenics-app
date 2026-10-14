/* Progressions-Leiter (Modal, auch vom Heute-Screen). Drei klar getrennte Teile:
   1. „Du trainierst gerade“ – aktuelle Stufe mit Clip, Vorgabe, Kernpunkten
   2. „Nächste Stufe“ – eigene Karte mit Bild und Namen der nächsten Stufe, wie man sie freischaltet
      und die Aktion, die sie beim Namen nennt (sonst wirkt „Trotzdem wechseln“ wie ein Wechsel der
      aktuellen Übung)
   3. alle Stufen als Zeitleiste – jede antippbar, klappt Clip, Vorgabe, Kernpunkte und Technik auf
   `focus` klappt eine Stufe gleich auf (z. B. aus einer Voraussetzung: „Hollow Body Rocks“). */
import { useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { platform } from '@lever/core/platform.ts'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { getLocale, t as tr, tn } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { Button, Card, color, ExerciseMedia, ExerciseStill, font, hasStill, Icon, SectionTitle, SheetScreen, Text } from '@/ui'
import { switchStep } from './shared'

export function Ladder({ pid, focus }: { pid: string; focus?: string }) {
  const { t } = useApp()
  const locale = getLocale()
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, locale])
  // mit Fokus (aus einer Voraussetzung) einmal zur aufgeklappten Stufe scrollen
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)
  const stagesY = useRef(0)
  const scrolled = useRef(false)
  const toFocus = (y: number) => {
    if (scrolled.current) return
    scrolled.current = true
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, stagesY.current + y - 24), animated: true }), 250)
  }
  const p = tree.find(x => x.pid === pid)
  if (!p) return <SheetScreen title={tr('skills.notFound')} />

  const region = p.region ? L.regionLabel(p.region) : p.workout?.name ?? ''
  const stage = tr('logic.stage', { i: p.step.index + 1, n: p.step.total })
  // nicht im Plan: Einordnung aus dem Katalog statt pauschal „Skill“ (Prehab ist Zubehör, nicht Skill)
  const data = catalogData(t.ix.catalog)
  const pattern = data.meta[p.step.exercise.id]?.pattern
  const block = p.workout ? p.block
    : data.skills.some(sk => sk.targets.includes(p.pid)) ? 'skill'
    : pattern === 'isolation' ? 'accessory' : pattern === 'core' ? 'core' : 'strength'
  const sub = `${[region, L.BLOCK_LABEL[block as keyof typeof L.BLOCK_LABEL], stage].filter(Boolean).join(' · ')}${p.paused ? tr('skills.paused') : ''}`
  const standing = L.stepStanding(t.sessions, p.step.exercise, p.step.target, p.step.nextTarget)
  const act = (a: 'unlock' | 'force' | 'back') => void switchStep(t, p, a)
  const ex = p.step.exercise
  const cues = ex.cues ?? []

  return (
    // Kopf nennt das Ziel der Leiter (letzte Stufe), nicht die aktuelle Übung – so sieht man, wohin es geht
    <SheetScreen title={L.progressionName(t.ix, p.pid)} sub={sub} scrollRef={scroll}>
      {/* aktuelle Stufe */}
      <Card active style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <ExerciseMedia exercise={ex} label={ex.name} style={{ height: 230, borderRadius: 0 }} />
        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text variant="eyebrow">{tr('skills.nowTraining')} · {stage}</Text>
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

          {!p.step.next && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: color.line }}>
              <Icon name="trophy" size={18} color={color.accent} />
              <Text variant="label" style={{ flex: 1 }}>{tr('skills.topStep')}</Text>
            </View>
          )}
        </View>
      </Card>

      {/* nächste Stufe: eigene Karte, Aktionen nennen sie beim Namen */}
      {p.step.next && <>
        <SectionTitle title={tr('skills.nextStage')} />
        <Unlock p={p} missing={standing.missing} onAct={act} />
      </>}

      {/* alle Stufen – antippbar */}
      <SectionTitle title={tr('skills.stages')} style={{ marginBottom: 0 }} />
      <Text variant="muted">{tr('skills.stagesHint')}</Text>
      <View onLayout={e => { stagesY.current = e.nativeEvent.layout.y }}>
        <Stages p={p} best={standing.best} focus={focus} onFocusLayout={toFocus} />
      </View>

      {p.step.prev && <Button variant="ghost" icon="undo" title={tr('skills.backTo', { name: p.step.prev.name })} onPress={() => act('back')} />}
    </SheetScreen>
  )
}

/** Karte der nächsten Stufe: Bild und Name, Kriterium (bezogen auf die aktuelle Übung), Fortschritt
    der zwei Einheiten und die Aktion – freischalten oder vorzeitig wechseln */
function Unlock({ p, missing, onAct }: { p: L.SkillPath; missing: string | null; onAct: (a: 'unlock' | 'force') => void }) {
  const next = p.step.next!
  const at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const done = p.progress?.done ?? 0
  const ready = !p.paused && done === 2
  return (
    <Card style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {hasStill(next.id)
          ? <ExerciseStill exercise={next} style={{ width: 64, height: 64, borderRadius: 14, borderCurve: 'continuous' }} />
          : <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: color.card2, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={18} color={color.muted} /></View>}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="eyebrow" style={{ color: color.muted }}>{tr('logic.stage', { i: p.step.index + 2, n: p.step.total })}</Text>
          <Text variant="title" style={{ fontSize: 22 }}>{next.name}</Text>
        </View>
      </View>
      {at == null
        ? <Text variant="muted">{tr('skills.noCriterionNext', { name: p.step.exercise.name })}</Text>
        : <>
          <Text variant="body">{tr('skills.unlockHow', { at, unit, name: p.step.exercise.name })}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={tr('skills.progressLabel', { n: done })}>
            {[1, 2].map(k => <View key={k} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: done >= k ? color.accent : 'rgba(255,255,255,0.09)' }} />)}
          </View>
          <Text variant="small" style={{ color: ready ? color.accent : color.muted }}>{tr('skills.progressOf', { n: done })}{missing ? ` · ${missing}` : tr('skills.ready')}</Text>
        </>}
      {ready
        ? <Button variant="primary" icon="up" title={tr('skills.unlock', { name: next.name })} onPress={() => onAct('unlock')} />
        : <Button variant="secondary" icon="up" title={tr('skills.forceTo', { name: next.name })} onPress={() => onAct('force')} />}
    </Card>
  )
}

/** Alle Stufen als Zeitleiste; eine Stufe aufgeklappt (Fokus oder angetippt) */
function Stages({ p, best, focus, onFocusLayout }: { p: L.SkillPath; best: string | null; focus?: string; onFocusLayout: (y: number) => void }) {
  const [open, setOpen] = useState<string | null>(focus && focus !== p.step.exercise.id ? focus : null)
  return (
    <View>
      {p.nodes.map((n, i) => (
        <View key={n.exercise.id} onLayout={n.exercise.id === focus && focus !== p.step.exercise.id ? e => onFocusLayout(e.nativeEvent.layout.y) : undefined}>
          <Node n={n} i={i} last={i === p.nodes.length - 1} best={best} open={open === n.exercise.id}
            onToggle={() => { platform().signals.haptic('tap'); setOpen(o => (o === n.exercise.id ? null : n.exercise.id)) }} />
          {open === n.exercise.id && <StageDetail n={n} />}
        </View>
      ))}
    </View>
  )
}

/** Stufe in der Zeitleiste: Punkt an der Linie, Standbild, Name, Stand */
function Node({ n, i, last, best, open, onToggle }: { n: L.SkillNode; i: number; last: boolean; best: string | null; open: boolean; onToggle: () => void }) {
  const sub = n.state === 'done' ? tn('skills.done', n.sessions)
    : n.state === 'current' ? tr('skills.current', { target: n.target.label, best: best ? tr('skills.bestSession', { best }) : '' })
    : last ? tr('skills.finalStep') : tr('skills.locked')
  const line = (on: boolean, show: boolean) => <View style={{ width: 2, flex: 1, backgroundColor: show ? (on ? color.chalk : color.line) : 'transparent' }} />
  const current = n.state === 'current', done = n.state === 'done'
  return (
    <Pressable style={{ flexDirection: 'row', gap: 14, minHeight: 76 }} accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={onToggle} accessibilityLabel={tr('skills.stepA11y', { i: i + 1, name: n.exercise.name, state: sub })}>
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
        <Icon name={open ? 'collapse' : 'down'} size={13} color={color.muted} />
      </View>
    </Pressable>
  )
}

/** aufgeklappte Stufe: Clip, Vorgabe, Kernpunkte, Ausgangsposition und Ausführung */
function StageDetail({ n }: { n: L.SkillNode }) {
  const ex = n.exercise
  return (
    <View style={{ marginLeft: 48, marginBottom: 12, gap: 10 }}>
      <ExerciseMedia exercise={ex} label={ex.name} style={{ height: 190, borderRadius: 16 }} />
      <Text variant="muted">{n.target.label}</Text>
      {(ex.cues ?? []).map(c => (
        <View key={c} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.accent, marginTop: 8 }} />
          <Text variant="body" style={{ flex: 1 }}>{c}</Text>
        </View>
      ))}
      {ex.technique.setup ? <View style={{ gap: 2 }}><Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('skills.howSetup')}</Text><Text variant="body">{ex.technique.setup}</Text></View> : null}
      {ex.technique.execution ? <View style={{ gap: 2 }}><Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 1.2 }}>{tr('skills.howExec')}</Text><Text variant="body">{ex.technique.execution}</Text></View> : null}
    </View>
  )
}
