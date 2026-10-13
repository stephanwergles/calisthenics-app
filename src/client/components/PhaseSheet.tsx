'use client'
/* Phase starten (abgeschlossene Aufgabe → Sheet): Pause/krank, Urlaub, Verletzung, Equipment.
   Dauer als Auswahl; „offen“ = bis auf Weiteres, endet mit „Beenden“ im Plan-Tab. */
import { useState } from 'react'
import type { Equipment, PhaseKind, Tendon } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { t as tr, type Key } from '../i18n'
import { toast } from '../toast'

/* Titel als Getter: lesen in der aktuellen Sprache */
const DURATIONS: { id: string; readonly title: string; days: number | null }[] = [
  { id: '3', get title() { return tr('plan.phase.dur.d3') }, days: 3 }, { id: '7', get title() { return tr('plan.phase.dur.d7') }, days: 7 },
  { id: '14', get title() { return tr('plan.phase.dur.d14') }, days: 14 }, { id: 'open', get title() { return tr('plan.phase.dur.open') }, days: null },
]
const INTRO = (k: PhaseKind) => tr(`plan.phase.intro.${k}` as Key)
const CTA = (k: PhaseKind) => tr(`plan.phase.cta.${k}` as Key)

export function PhaseSheet({ t, kind, onClose }: { t: Training; kind: PhaseKind; onClose: () => void }) {
  const native = useNativeShell()
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
    onClose()
  }
  const choices = kind === 'injury'
    ? (Object.entries(L.TENDON_LABEL) as [Tendon, string][]).map(([id, title]) => ({ id, title, on: tendons.includes(id), set: (on: boolean) => setTendons(x => toggle(x, id, on)) }))
    : kind === 'equipment'
      ? (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]) => ({ id, title, on: equipment.includes(id), set: (on: boolean) => setEquipment(x => toggle(x, id, on)) }))
      : []

  useNativeSheet(native ? {
    id: 'phase', title: L.PHASE_LABEL[kind], subtitle: INTRO(kind), detents: choices.length ? ['large'] : ['medium', 'large'],
    blocks: [
      { type: 'section', title: tr('plan.phase.duration') },
      { type: 'segmented', id: 'dur', options: DURATIONS.map(d => ({ id: d.id, title: d.title })), selected: dur },
      ...(choices.length ? [{ type: 'section', title: kind === 'injury' ? tr('plan.phase.affected') : tr('plan.phase.available') } as NBlock] : []),
      ...choices.map((c): NBlock => ({ type: 'check', style: 'select', id: `c:${c.id}`, title: c.title, on: c.on })),
    ],
    footer: [{ id: 'save', title: valid ? CTA(kind) : tr('plan.phase.pickJoint'), symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('dur:')) setDur(e.id.slice(4))
    else if (e.type === 'toggle' && e.id?.startsWith('c:')) choices.find(c => c.id === e.id!.slice(2))?.set(!!e.value)
    else if (e.type === 'tap' && e.id === 'save') save()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title={L.PHASE_LABEL[kind]} sub={INTRO(kind)} onClose={onClose}
      footer={<button className="btn btn-primary btn-block" disabled={!valid} onClick={save}><Icon name="check" size={18} /> {CTA(kind)}</button>}>
      <h4 className="pe-section">{tr('plan.phase.duration')}</h4>
      <div className="seg pill" role="group" aria-label={tr('plan.phase.duration')}>
        {DURATIONS.map(d => <button key={d.id} className={dur === d.id ? 'on' : ''} aria-pressed={dur === d.id} onClick={() => setDur(d.id)}>{d.title}</button>)}
      </div>
      {choices.length > 0 && <>
        <h4 className="pe-section">{kind === 'injury' ? tr('plan.phase.affected') : tr('plan.phase.available')}</h4>
        <ul className="pe-days">
          {choices.map(c => (
            <li key={c.id}>
              <button className={`check${c.on ? ' on' : ''}`} aria-pressed={c.on} onClick={() => c.set(!c.on)}>
                <span className="box" aria-hidden="true">{c.on && <Icon name="check" size={14} />}</span>
                <span><b>{c.title}</b></span>
              </button>
            </li>
          ))}
        </ul>
      </>}
    </Sheet>
  )
}
