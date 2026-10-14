/* Phase starten (Sheet mit Detents): Pause/krank, Urlaub, Verletzung, Equipment. Dauer als
   Auswahl; „offen“ = bis auf Weiteres, endet mit „Beenden“ im Plan-Tab. (Web: PhaseSheet) */
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import type { Equipment, PhaseKind, Tendon } from '@lever/domain/model.ts'
import * as L from '@lever/core/logic.ts'
import { t as tr, type Key } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'
import { useApp } from '@/state/app'
import { Button, ChipChoices, Segmented } from '@/ui'
import { Section } from '@/screens/plan/parts'
import { FormSheet } from '@/screens/training/parts'

const DURATIONS: { id: string; key: Key; days: number | null }[] = [
  { id: '3', key: 'plan.phase.dur.d3', days: 3 }, { id: '7', key: 'plan.phase.dur.d7', days: 7 },
  { id: '14', key: 'plan.phase.dur.d14', days: 14 }, { id: 'open', key: 'plan.phase.dur.open', days: null },
]
const KINDS: PhaseKind[] = ['pause', 'vacation', 'injury', 'equipment']

export default function PhaseScreen() {
  const { t } = useApp()
  const param = useLocalSearchParams<{ kind?: string }>().kind
  const kind: PhaseKind = KINDS.includes(param as PhaseKind) ? (param as PhaseKind) : 'pause'
  const [dur, setDur] = useState(kind === 'injury' ? 'open' : '7')
  const [tendons, setTendons] = useState<Tendon[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const valid = kind !== 'injury' || tendons.length > 0
  const toggle = <T,>(list: T[], x: T, on: boolean) => (on ? [...new Set([...list, x])] : list.filter(y => y !== x))

  const save = () => {
    if (!valid) return
    const days = DURATIONS.find(d => d.id === dur)!.days
    const extra = kind === 'injury' ? { tendons } : kind === 'equipment' ? { equipment } : {}
    t.setState(st => L.withPhase(st, L.newPhase(kind, t.today, days, extra)))
    toast(tr('common.toast.phaseStarted'), 'success')
    router.back()
  }

  const choices = kind === 'injury'
    ? (Object.entries(L.TENDON_LABEL) as [Tendon, string][]).map(([id, title]) => ({ id: id as string, title, on: tendons.includes(id) }))
    : kind === 'equipment'
      ? (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]) => ({ id: id as string, title, on: equipment.includes(id) }))
      : []
  const onToggle = (id: string, on: boolean) => {
    if (kind === 'injury') setTendons(x => toggle(x, id as Tendon, on))
    else setEquipment(x => toggle(x, id as Equipment, on))
  }

  return (
    <FormSheet title={L.PHASE_LABEL[kind]} sub={tr(`plan.phase.intro.${kind}` as Key)}
      footer={<Button variant="primary" size="lg" icon="check" disabled={!valid}
        title={valid ? tr(`plan.phase.cta.${kind}` as Key) : tr('plan.phase.pickJoint')} onPress={save} />}>
      <Section title={tr('plan.phase.duration')} />
      <Segmented label={tr('plan.phase.duration')} value={dur} onChange={setDur}
        options={DURATIONS.map(d => ({ id: d.id, title: tr(d.key) }))} />
      {choices.length > 0 && <>
        <Section title={kind === 'injury' ? tr('plan.phase.affected') : tr('plan.phase.available')} />
        <ChipChoices items={choices} onToggle={onToggle} />
      </>}
    </FormSheet>
  )
}
