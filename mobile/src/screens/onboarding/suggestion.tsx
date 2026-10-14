/* Onboarding – letzter Schritt: Planvorschlag aus Zielen, Tagen, Ausrüstung und Stand, je
   Wochentag vorher → nachher. Erst „Übernehmen“ schreibt den Plan; „Später“ behält den
   Standardplan. Beides beendet das Onboarding. (Web: SuggestionSheet als Push-Seite) */
import { View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { t as tr, tn, type Key } from '@lever/core/i18n/index.ts'
import { Button, color, font, ListGroup, SectionTitle, SheetScreen, Text } from '@/ui'
import { useApp } from '@/state/app'
import { useFinishOnboarding } from './state'

const KIND: Record<string, Key> = { neu: 'plan.suggestion.kind.new', raus: 'plan.suggestion.kind.out', sätze: 'plan.suggestion.kind.sets' }

export function OnboardingSuggestion() {
  const { t, ps } = useApp()
  const finish = useFinishOnboarding()
  const s = ps.suggestion
  if (!s) return (
    <SheetScreen title={tr('plan.suggestion.title')} sub={tr('plan.suggestion.intro')}
      footer={<Button variant="primary" size="lg" icon="check" title={tr('common.done')} onPress={finish} />} />
  )
  const goals = L.profileOf(t.ix, t.state).goals.map(g => catalogData(t.ix.catalog).skills.find(x => x.id === g)?.name ?? g).join(', ')
  const head = (d: L.DayDiff) => `${L.WEEKDAY_LONG[d.day]} · ${d.before ?? tr('plan.restDay')} → ${d.after ?? tr('plan.restDay')}`
  const kept = (d: L.DayDiff) => d.changes.filter(c => c.kind === 'bleibt').map(c => c.name)
  return (
    <SheetScreen title={tr('plan.suggestion.title')} sub={tn('plan.suggestion.sub', s.changes, { goals })}
      footer={<>
        <Button variant="primary" size="lg" icon="check" title={tr('plan.suggestion.accept', { n: (t.plan?.version ?? 0) + 1 })} onPress={() => { ps.accept(); finish() }} />
        <Button variant="secondary" title={tr('plan.suggestion.later')} onPress={() => { ps.dismiss(); finish() }} />
      </>}>
      <Text variant="muted">{tr('plan.suggestion.intro')}</Text>
      {s.warnings.map(w => <Text key={w} variant="small" style={{ color: color.danger }}>{w}</Text>)}
      {s.diff.map(d => {
        const rows = d.changes.filter(c => c.kind !== 'bleibt')
        return (
          <View key={d.day} style={{ gap: 8 }}>
            <SectionTitle title={head(d)} style={{ marginBottom: 0 }} />
            {rows.length > 0 && <ListGroup rows={rows.map(c => ({ title: c.name, subtitle: c.detail, trailing: tr(KIND[c.kind]) }))} />}
            {kept(d).length > 0 && <Text variant="small" style={{ fontFamily: font.body }}>{tr('plan.suggestion.kept', { names: kept(d).join(', ') })}</Text>}
          </View>
        )
      })}
    </SheetScreen>
  )
}
