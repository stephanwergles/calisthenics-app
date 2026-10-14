/* Tab „Plan“: Planvorschlag (wartet auf Bestätigung), Vorlagen, die Woche (Tag → Workout bzw.
   belegen), eigene Workouts und Phasen. Bearbeitet wird in Modals (workouts/*, templates/*,
   suggestion, phase). (Web: src/client/components/PlanView.tsx) */
import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import type { PhaseKind } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { useApp } from '@/state/app'
import { TabHeader } from '@/navigation'
import { ask, Button, Card, color, font, GUTTER, Icon, SectionTitle, space, Text, type IconName } from '@/ui'
import { DAY_NAME, Rows } from './parts'

const count = (n: number) => tn('plan.exercises', n)
const PHASE_ICON: Record<PhaseKind, IconName> = { pause: 'bed', vacation: 'airplane', injury: 'medical', equipment: 'dumbbell' }

export function PlanTab() {
  const { t, ps } = useApp()
  const active = L.activePhases(t.state, t.today)
  const upcoming = (t.state.phases ?? []).filter(p => p.from > t.today)
  const today = L.weekdayOf(t.today)
  const list = L.workoutsInWeekOrder(t.ix)
  const week = L.WEEK_ORDER.map(d => ({ d, w: t.ix.catalog.weekplan[d] ? t.ix.workouts.get(t.ix.catalog.weekplan[d]!) : undefined }))
  const days = week.filter(x => x.w).length
  const minutes = useMemo(() => {
    const m = week.flatMap(x => (x.w ? [L.estimateMinutes(t.sessions, x.w.id)] : [])).filter((x): x is number => !!x)
    return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length / 5) * 5 : null
  }, [t.ix, t.sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const syncError = !!t.sync.account && t.sync.phase === 'error'

  const openWorkout = (id: string) => router.push({ pathname: '/workouts/[id]', params: { id } })
  const undo = async () => {
    if (await ask({ title: tr('plan.view.undoTitle'), message: tr('plan.view.undoMessage'), ok: tr('plan.view.undoOk') })) ps.undo()
  }
  const endPhase = async (id: string, kind: PhaseKind) => {
    if (!await ask({ title: tr('plan.view.endTitle', { phase: L.PHASE_LABEL[kind] }), message: tr('plan.view.endMessage'), ok: tr('plan.view.end') })) return
    t.setState(st => L.withPhaseEnded(st, id, t.today))
    toast(tr('common.toast.phaseEnded'))
  }

  return (
    <>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 40, gap: space.md }}>
        {/* Kopf */}
        <View style={{ gap: 6, marginBottom: space.sm }}>
          <Text variant="small" style={{ fontFamily: font.bodySemi, textTransform: 'uppercase', letterSpacing: 1.6 }}>
            {t.plan ? tr('plan.view.myPlan') : tr('plan.view.defaultPlan')} · {tn('plan.view.days', days)}{minutes ? tr('plan.view.minutes', { n: minutes }) : ''}
          </Text>
        </View>

        {/* Vorschlag / Ziele / ausgeblendet */}
        {ps.suggestion ? (
          <Card active onPress={() => router.push('/suggestion')} label={`${tr('plan.view.suggestTitle')}, ${tn('plan.view.suggestChanges', ps.suggestion.changes)}`}
            style={{ backgroundColor: color.accentDim }}>
            <Text variant="eyebrow">{tr('plan.view.suggestLabel')}</Text>
            <Text variant="display" style={{ fontSize: 28 }}>{tr('plan.view.suggestTitle')}</Text>
            <Text variant="muted">{tn('plan.view.suggestChanges', ps.suggestion.changes)}</Text>
            <More text={tr('plan.view.view')} />
          </Card>
        ) : !ps.hasGoals ? (
          <Card onPress={() => router.push('/profile/goals')} label={`${tr('plan.view.goalsTitle')}, ${tr('plan.view.goalsSub')}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="target" size={22} color={color.accent} />
              <Text variant="title" style={{ flex: 1 }}>{tr('plan.view.goalsTitle')}</Text>
              <Icon name="right" size={14} color={color.muted} />
            </View>
            <Text variant="muted">{tr('plan.view.goalsSub')}</Text>
          </Card>
        ) : ps.hidden ? (
          <Button variant="ghost" icon="info" title={tr('plan.view.showHidden')} onPress={() => { ps.show(); router.push('/suggestion') }} />
        ) : null}
        {ps.canUndo && <Button variant="ghost" icon="undo" title={tr('plan.view.undo')} onPress={() => void undo()} />}

        {/* Vorlagen */}
        <Card onPress={() => router.push('/templates')} label={`${tr('plan.view.templates')}, ${tr('plan.view.templatesSub')}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="grid" size={22} color={color.accent} />
            <Text variant="title" style={{ flex: 1 }}>{tr('plan.view.templates')}</Text>
            <Icon name="right" size={14} color={color.muted} />
          </View>
          <Text variant="muted">{tr('plan.view.templatesSub')}</Text>
        </Card>

        {/* Woche */}
        <SectionTitle title={tr('plan.view.week')} />
        <Rows rows={week.map(({ d, w }) => ({
          key: d,
          title: w ? w.name : tr('plan.restDay'),
          off: !w,
          subtitle: w ? `${DAY_NAME[d]} · ${w.focus && w.focus !== w.name ? `${w.focus} · ` : ''}${count(w.slots.length)}` : DAY_NAME[d],
          tag: d === today ? tr('plan.view.today') : undefined,
          label: `${DAY_NAME[d]}: ${w ? w.name : tr('plan.restDay')}${d === today ? tr('plan.view.todaySuffix') : ''}`,
          onPress: () => (w ? openWorkout(w.id) : router.push({ pathname: '/workouts/day', params: { day: d } })),
        }))} />

        {/* Meine Workouts */}
        <SectionTitle title={tr('plan.view.myWorkouts')}
          right={<Button size="sm" variant="ghost" icon="plus" title={tr('plan.view.new')} onPress={() => openWorkout('new')} />} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map(w => {
            const planned = L.plannedDays(t.ix, w.id).map(x => L.WEEKDAY_SHORT[x]).join(' · ')
            return (
              <Card key={w.id} onPress={() => openWorkout(w.id)} label={`${w.name}, ${w.focus}, ${count(w.slots.length)}, ${planned || tr('plan.view.noDay')}`}
                style={{ flexBasis: '47%', flexGrow: 1, gap: 4, minHeight: 112 }}>
                <Text variant="title" style={{ fontSize: 20 }} numberOfLines={2}>{w.name}</Text>
                <Text variant="small" numberOfLines={2}>{w.focus} · {count(w.slots.length)}</Text>
                <View style={{ flex: 1 }} />
                <Text variant="small" style={{ fontFamily: font.bodySemi, color: planned ? color.accent : color.muted }}>{planned || tr('plan.view.noDay')}</Text>
              </Card>
            )
          })}
        </View>

        {/* Phasen */}
        <SectionTitle title={tr('plan.view.phases')} />
        {[...active, ...upcoming].map(p => (
          <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name={PHASE_ICON[p.kind]} size={20} color={color.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{L.fmtPhase(p)}</Text>
              <Text variant="small">{tr('plan.view.since', { date: L.fmtShortDate(p.from) })}</Text>
            </View>
            <Button size="sm" title={tr('plan.view.end')} onPress={() => void endPhase(p.id, p.kind)} />
          </Card>
        ))}
        {!active.length && <Text variant="muted">{tr('plan.view.phaseHint')}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(Object.keys(L.PHASE_LABEL) as PhaseKind[]).filter(k => !active.some(p => p.kind === k)).map(k => (
            <Button key={k} icon={PHASE_ICON[k]} title={L.PHASE_LABEL[k]} style={{ flexBasis: '47%', flexGrow: 1 }}
              onPress={() => router.push({ pathname: '/phase', params: { kind: k } })} />
          ))}
        </View>

        {!t.plan && <Text variant="small" style={{ marginTop: space.md }}>{tr('plan.view.defaultHint')}</Text>}
      </ScrollView>
      <TabHeader title={tr('plan.view.title')} syncError={syncError} />
    </>
  )
}

function More({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
      <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: color.accent }}>{text}</Text>
      <Icon name="right" size={12} color={color.accent} />
    </View>
  )
}
