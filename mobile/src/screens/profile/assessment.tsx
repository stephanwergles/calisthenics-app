/* Einstufung (Kurztest): Werte je Test → höhere Startstufen (nie zurück), erst nach „Übernehmen“.
   Tests mit Stufen (Pistol) als echte Radio-Auswahl mit Erklärung je Stufe. „Nur Werte speichern“
   merkt die Werte ohne Planänderung. Im Profil bleibt die Seite nach dem Speichern offen, nur das
   Onboarding geht weiter (onDone). (Web: AssessmentPage) */
import { useState } from 'react'
import { View } from 'react-native'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import { placement } from '@lever/domain/assessment.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { ask, Button, Choices, font, ListGroup, SectionTitle, SheetScreen, Stepper, Text } from '@/ui'
import { useApp } from '@/state/app'
import { blurb, useProfile } from './shared'

export function AssessmentPage({ onDone, onSkip }: { onDone?: () => void; onSkip?: () => void }) {
  const { t } = useApp()
  const { profile, change } = useProfile(t)
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...profile.assessment?.results }))
  const A = catalogData(t.ix.catalog).assessment
  const changes = L.placementChanges(t.ix, t.state, placement(A, t.ix.catalog, values))
  const last = profile.assessment ? tr('profile.assessment.last', { date: L.fmtShortDate(profile.assessment.date) }) : tr('profile.assessment.never')
  const testOf = (id: string) => A.tests.find(x => x.id === id)!
  const fmt = (id: string, v: number) => {
    const test = testOf(id)
    return test.unit === 'level' ? test.levels?.[v] ?? '' : test.unit === 'seconds' ? tr('profile.assessment.seconds', { v }) : String(v)
  }
  const step = (id: string) => (testOf(id).unit === 'seconds' ? 5 : 1)
  const set = (id: string, v: number) => {
    const test = testOf(id)
    const max = test.unit === 'level' ? (test.levels?.length ?? 1) - 1 : 600
    setValues(x => ({ ...x, [id]: Math.min(max, Math.max(0, v)) }))
  }
  /** raise = höhere Stufen übernehmen; sonst nur die Werte merken (Plan bleibt) */
  const apply = async (raise: boolean) => {
    const up = raise ? changes : []
    if (up.length && !await ask({
      title: tr('profile.assessment.askTitle'),
      message: tr('profile.assessment.askMessage', { list: up.map(c => tr('profile.assessment.change', { ladder: c.ladder, fromName: c.fromName, toName: c.toName })).join('\n') }),
      ok: tn('profile.assessment.apply', up.length),
    })) return
    if (up.length) t.setState(st => L.withPlacement(t.ix, st, up))
    change(p => ({ ...p, assessment: { date: t.today, results: values } }))
    toast(up.length ? tr('common.toast.assessmentApplied') : tr('common.toast.saved'), 'success')
    onDone?.()
  }
  const footer = (
    <>
      {changes.length
        ? <>
            <Button variant="primary" size="lg" icon="up" title={tn('profile.assessment.apply', changes.length)} onPress={() => void apply(true)} />
            <Button variant="secondary" title={tr('profile.assessment.saveOnly')} onPress={() => void apply(false)} />
          </>
        : <Button variant="primary" size="lg" icon="check" title={tr('profile.assessment.save')} onPress={() => void apply(false)} />}
      {onSkip && <Button variant="ghost" title={tr('onboarding.skipStep')} onPress={onSkip} />}
    </>
  )
  return (
    <SheetScreen title={tr('profile.row.assessment')} sub={tr('profile.assessment.sub', { last })} footer={footer}>
      {A.tests.map(x => x.unit === 'level' ? (
        <View key={x.id} style={{ gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel={x.name}>
          <Text variant="small" style={{ fontFamily: font.bodyBold, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12, marginTop: 6 }}>{x.name}</Text>
          <Choices mode="radio" onToggle={id => set(x.id, Number(id))}
            items={(x.levels ?? []).map((title, i) => ({
              id: String(i), title: title.charAt(0).toUpperCase() + title.slice(1),
              sub: blurb(`profile.assessment.levelHint.${x.id}.${i}`), on: (values[x.id] ?? 0) === i,
            }))} />
        </View>
      ) : (
        <Stepper key={x.id} label={x.name} value={fmt(x.id, values[x.id] ?? 0)}
          onMinus={() => set(x.id, (values[x.id] ?? 0) - step(x.id))} onPlus={() => set(x.id, (values[x.id] ?? 0) + step(x.id))}
          minusLabel={tr('profile.assessment.less', { name: x.name })} plusLabel={tr('profile.assessment.more', { name: x.name })} />
      ))}
      <SectionTitle title={changes.length ? tr('profile.assessment.wouldRaise') : tr('profile.assessment.result')} />
      {changes.length ? (
        <>
          <Text variant="muted">{tr('profile.assessment.raiseIntro')}</Text>
          <ListGroup rows={changes.map(c => ({
            title: c.ladder, icon: 'up' as const,
            subtitle: `${tr('profile.assessment.now', { name: c.fromName })}\n${tr('profile.assessment.next', { name: c.toName })}`,
            trailing: tr('profile.assessment.stage', { from: c.from + 1, to: c.to + 1 }),
          }))} />
        </>
      ) : <Text variant="muted">{tr('profile.assessment.unchanged')}</Text>}
    </SheetScreen>
  )
}
