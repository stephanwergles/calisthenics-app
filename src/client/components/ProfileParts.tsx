'use client'
/* Profil-Eingaben als Sheets: Ziele, Ausrüstung, Trainingstage & Dauer. Gespeichert im
   Trainingsstand (state.profile, synchronisiert). Ändern den Plan nicht – sie sind Eingaben
   für Vorschläge, die erst nach Bestätigung gelten. */
import type { Equipment, Profile, Weekday } from '@/domain/model'
import skillsJson from '@/seed/skills.json'
import type { Skill } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { DAY_NAME } from './PlanEditor'

export const SKILLS = (skillsJson as unknown as { skills: Skill[] }).skills

/** Profil lesen und ändern (legt es beim ersten Ändern mit Standardwerten an) */
export function useProfile(t: Training) {
  const profile = L.profileOf(t.ix, t.state)
  const change = (fn: (p: Profile) => Profile) => t.setState(st => ({ ...st, profile: fn(L.profileOf(t.ix, st)) }))
  return { profile, change }
}

const choiceSub = (c: ReturnType<typeof L.skillChoices>[number]) =>
  c.reached ? 'erreicht' : c.missing.length ? `fehlt noch: ${c.missing.join(', ')}` : `${Math.round(c.score * 100)} % bereit`

/** Wiederverwendbare Auswahlliste: nativ Häkchen-Zeilen, im Web Buttons */
function Choices({ items, onToggle }: { items: { id: string; title: string; sub?: string; on: boolean }[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <ul className="pe-days">
      {items.map(x => (
        <li key={x.id}>
          <button className={`check${x.on ? ' on' : ''}`} aria-pressed={x.on} onClick={() => onToggle(x.id, !x.on)}>
            <span className="box" aria-hidden="true">{x.on && <Icon name="check" size={14} />}</span>
            <span><b>{x.title}</b>{x.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function GoalPicker({ t, onClose, parent }: { t: Training; onClose: () => void; parent?: { id: string; title: string } }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = L.skillChoices(t.ix, t.state, SKILLS).map(c => ({ id: c.skill, title: c.name, sub: choiceSub(c), on: profile.goals.includes(c.skill) }))
  const sub = `Bis zu drei · ${profile.goals.length} gewählt · sortiert nach „realistisch als Nächstes“`
  const toggle = (id: string, on: boolean) => change(p => L.withGoal(p, id, on))
  useNativeSheet(native ? {
    id: 'goals', parent: parent?.id, title: 'Ziele', subtitle: sub, detents: ['medium', 'large'],
    blocks: items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, subtitle: x.sub, on: x.on })),
  } : null, e => {
    if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet title="Ziele" sub={sub} back={parent?.title} onClose={onClose}><Choices items={items} onToggle={toggle} /></Sheet>
}

export function EquipmentSheet({ t, onClose, parent }: { t: Training; onClose: () => void; parent?: { id: string; title: string } }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]) => ({ id, title, on: profile.equipment.includes(id) }))
  const sub = 'Vorschläge nutzen nur Übungen, die du damit machen kannst. Boden und Wand gelten immer.'
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, equipment: on ? [...new Set([...p.equipment, id as Equipment])] : p.equipment.filter(e => e !== id) }))
  useNativeSheet(native ? {
    id: 'equipment', parent: parent?.id, title: 'Ausrüstung', subtitle: sub, detents: ['medium', 'large'],
    blocks: items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
  } : null, e => {
    if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet title="Ausrüstung" sub={sub} back={parent?.title} onClose={onClose}><Choices items={items} onToggle={toggle} /></Sheet>
}

export function DaysSheet({ t, onClose, parent }: { t: Training; onClose: () => void; parent?: { id: string; title: string } }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = L.WEEK_ORDER.map(d => ({ id: d, title: DAY_NAME[d], on: profile.days.includes(d) }))
  const sub = 'Grundlage für Planvorschläge – dein Wochenplan ändert sich erst, wenn du einen Vorschlag bestätigst.'
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, days: L.WEEK_ORDER.filter(d => (d === id ? on : p.days.includes(d))) as Weekday[] }))
  const setMin = (m: number) => change(p => ({ ...p, minutes: Math.min(180, Math.max(30, m)) }))
  useNativeSheet(native ? {
    id: 'days', parent: parent?.id, title: 'Trainingstage & Dauer', subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stepper', id: 'min', label: 'Minuten je Einheit', value: String(profile.minutes) },
      ...items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'min:minus') setMin(profile.minutes - 5)
    else if (e.type === 'tap' && e.id === 'min:plus') setMin(profile.minutes + 5)
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title="Trainingstage & Dauer" sub={sub} back={parent?.title} onClose={onClose}>
      <div className="stepper">
        <span className="stepper-label">Minuten je Einheit</span>
        <div className="stepper-row">
          <button className="btn btn-secondary btn-icon" aria-label="Kürzer" onClick={() => setMin(profile.minutes - 5)}><Icon name="minus" size={20} /></button>
          <output className="stepper-val">{profile.minutes}</output>
          <button className="btn btn-secondary btn-icon" aria-label="Länger" onClick={() => setMin(profile.minutes + 5)}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <Choices items={items} onToggle={toggle} />
    </Sheet>
  )
}

/** Zusammenfassungen für die Profil-Zeilen */
export function profileSummary(t: Training) {
  const p = L.profileOf(t.ix, t.state)
  const names = p.goals.map(g => SKILLS.find(s => s.id === g)?.name ?? g)
  return {
    goals: names.length ? names.join(' · ') : 'noch keine gewählt',
    equipment: p.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL]).filter(Boolean).join(', ') || 'nur Boden und Wand',
    days: `${L.WEEK_ORDER.filter(d => p.days.includes(d)).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || 'keine Tage'} · ca. ${p.minutes} min`,
  }
}
