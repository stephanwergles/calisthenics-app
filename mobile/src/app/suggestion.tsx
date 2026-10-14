/* Planvorschlag ansehen: je Wochentag vorher → nachher, was dazukommt, wegfällt, sich ändert.
   Erst „Übernehmen“ schreibt eine neue Planversion; „Später“ blendet ihn aus. (Web: SuggestionSheet) */
import { View } from 'react-native'
import { router, Stack } from 'expo-router'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr, tn, type Key } from '@lever/core/i18n/index.ts'
import { useApp } from '@/state/app'
import { CloseButton, stackScreenOptions } from '@/navigation'
import { Button, color, font, SheetScreen, Text } from '@/ui'
import { DAY_NAME, Notice, Rows, Section } from '@/screens/plan/parts'

const KIND: Record<string, Key> = { neu: 'plan.suggestion.kind.new', raus: 'plan.suggestion.kind.out', sätze: 'plan.suggestion.kind.sets' }

export default function SuggestionScreen() {
  const { t, ps } = useApp()
  const s = ps.suggestion ?? ps.hidden
  const header = <>
    <Stack.Screen options={{ ...stackScreenOptions, headerShown: true }} />
    <CloseButton onPress={() => router.back()} />
  </>
  if (!s) return <>{header}<SheetScreen title={tr('plan.suggestion.title')} /></>

  const profile = L.profileOf(t.ix, t.state)
  const goals = profile.goals.map(g => catalogData(t.ix.catalog).skills.find(x => x.id === g)?.name ?? g).join(', ')
  const version = t.plan?.version ?? 0
  const head = (d: L.DayDiff) => `${DAY_NAME[d.day]} · ${d.before ?? tr('plan.restDay')} → ${d.after ?? tr('plan.restDay')}`
  const kept = (d: L.DayDiff) => d.changes.filter(c => c.kind === 'bleibt').map(c => c.name)
  const accept = () => { ps.accept(); router.back() }
  const later = () => { ps.dismiss(); router.back() }

  return (
    <>
      {header}
      <SheetScreen title={tr('plan.suggestion.title')} sub={tn('plan.suggestion.sub', s.changes, { goals })}
        footer={<>
          <Button variant="primary" size="lg" icon="check" title={tr('plan.suggestion.accept', { n: version + 1 })} onPress={accept} />
          <Button title={tr('plan.suggestion.later')} onPress={later} />
        </>}>
        <Text variant="muted">{tr('plan.suggestion.intro')}</Text>
        {/* Zeitbudget sichtbar machen: es bestimmt, wie viele Übungen pro Tag Platz haben */}
        <Notice text={tr('plan.suggestion.budget', { days: profile.days.length, min: profile.minutes })} />
        <Button size="sm" variant="ghost" icon="calendar" title={tr('plan.suggestion.changeBudget')} onPress={() => router.push('/profile/days')} />
        {s.warnings.map(w => <Notice key={w} text={w} tone="warn" />)}
        {s.diff.map(d => {
          const changes = d.changes.filter(c => c.kind !== 'bleibt')
          return (
            <View key={d.day} style={{ gap: 8 }}>
              <Section title={head(d)} />
              {changes.length > 0 && <Rows rows={changes.map(c => ({
                key: `${c.kind}-${c.name}`, title: c.name,
                icon: c.kind === 'neu' ? 'plus' as const : c.kind === 'raus' ? 'minus' as const : 'adjust' as const,
                subtitle: [tr(KIND[c.kind]), c.detail].filter(Boolean).join(' · '),
              }))} />}
              {kept(d).length > 0 && (
                <Text variant="small" style={{ fontFamily: font.bodyMedium, color: color.muted }}>{tr('plan.suggestion.kept', { names: kept(d).join(', ') })}</Text>
              )}
            </View>
          )
        })}
      </SheetScreen>
    </>
  )
}
