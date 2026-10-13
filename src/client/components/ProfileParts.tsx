'use client'
/* Profil-Eingaben als Sheets: Ziele, Ausrüstung, Trainingstage & Dauer. Gespeichert im
   Trainingsstand (state.profile, synchronisiert). Ändern den Plan nicht – sie sind Eingaben
   für Vorschläge, die erst nach Bestätigung gelten. */
import type { Equipment, Profile, Weekday } from '@/domain/model'
import { placement } from '@/domain/assessment'
import { catalogData } from '../data'
import { useState } from 'react'
import { ask, isNative } from '../native'
import { sendFeedback } from '../sync'
import { APP_VERSION } from '../version'
import * as L from '../logic'
import type { Training } from '../useTraining'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { DAY_NAME } from './PlanEditor'


/** Profil lesen und ändern (legt es beim ersten Ändern mit Standardwerten an) */
export function useProfile(t: Training) {
  const profile = L.profileOf(t.ix, t.state)
  const change = (fn: (p: Profile) => Profile) => t.setState(st => ({ ...st, profile: fn(L.profileOf(t.ix, st)) }))
  return { profile, change }
}

/** Onboarding: Weiter-Button in der Fußzeile */
export type Next = { title: string; onNext: () => void }
const footerOf = (next?: Next) => (next ? [{ id: 'next', title: next.title, symbol: 'arrow.right', style: 'prominent' as const }] : undefined)
const webFooter = (next?: Next) => next && <button className="btn btn-primary btn-block" onClick={next.onNext}>{next.title}</button>

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

export function GoalPicker({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = L.skillChoices(t.ix, t.state, catalogData(t.ix.catalog).skills).map(c => ({ id: c.skill, title: c.name, sub: choiceSub(c), on: profile.goals.includes(c.skill) }))
  const sub = `Bis zu drei · ${profile.goals.length} gewählt · sortiert nach „realistisch als Nächstes“`
  const toggle = (id: string, on: boolean) => change(p => L.withGoal(p, id, on))
  useNativeSheet(native ? {
    id: 'goals', parent: parent?.id, footer: footerOf(next), title: 'Ziele', subtitle: sub, detents: ['medium', 'large'],
    blocks: items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, subtitle: x.sub, on: x.on })),
  } : null, e => {
    if (e.type === 'tap' && e.id === 'next') next?.onNext()
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet title="Ziele" sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}><Choices items={items} onToggle={toggle} /></Sheet>
}

export function EquipmentSheet({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]) => ({ id, title, on: profile.equipment.includes(id) }))
  const sub = 'Vorschläge nutzen nur Übungen, die du damit machen kannst. Boden und Wand gelten immer.'
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, equipment: on ? [...new Set([...p.equipment, id as Equipment])] : p.equipment.filter(e => e !== id) }))
  useNativeSheet(native ? {
    id: 'equipment', parent: parent?.id, footer: footerOf(next), title: 'Ausrüstung', subtitle: sub, detents: ['medium', 'large'],
    blocks: items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
  } : null, e => {
    if (e.type === 'tap' && e.id === 'next') next?.onNext()
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet title="Ausrüstung" sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}><Choices items={items} onToggle={toggle} /></Sheet>
}

export function DaysSheet({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = L.WEEK_ORDER.map(d => ({ id: d, title: DAY_NAME[d], on: profile.days.includes(d) }))
  const sub = 'Grundlage für Planvorschläge – dein Wochenplan ändert sich erst, wenn du einen Vorschlag bestätigst.'
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, days: L.WEEK_ORDER.filter(d => (d === id ? on : p.days.includes(d))) as Weekday[] }))
  const setMin = (m: number) => change(p => ({ ...p, minutes: Math.min(180, Math.max(30, m)) }))
  // Aufteilung: Vorlagen mit so vielen Themen wie Tagen, oder automatisch
  const fitting = catalogData(t.ix.catalog).splits.filter(x => x.themes.length === profile.days.length)
  const chosen = fitting.some(x => x.id === profile.split) ? profile.split : undefined
  const splits = [{ id: 'auto', title: 'Automatisch', sub: 'passend zu deinen Zielen' },
    ...fitting.map(x => ({ id: x.id, title: x.name, sub: x.themes.map(th => th.name).join(' · ') }))]
  const pickSplit = (id: string) => change(p => { const { split: _, ...rest } = p; return id === 'auto' ? rest : { ...rest, split: id } })
  useNativeSheet(native ? {
    id: 'days', parent: parent?.id, footer: footerOf(next), title: 'Trainingstage & Dauer', subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stepper', id: 'min', label: 'Minuten je Einheit', value: String(profile.minutes) },
      ...items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
      ...(fitting.length ? [
        { type: 'section', title: 'Aufteilung' } as NBlock,
        ...splits.map((x): NBlock => ({ type: 'check', style: 'select', id: `split:${x.id}`, title: x.title, subtitle: x.sub, on: (chosen ?? 'auto') === x.id })),
      ] : []),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'next') { next?.onNext(); return }
    if (e.type === 'toggle' && e.id?.startsWith('split:')) { pickSplit(e.id.slice(6)); return }
    if (e.type === 'tap' && e.id === 'min:minus') setMin(profile.minutes - 5)
    else if (e.type === 'tap' && e.id === 'min:plus') setMin(profile.minutes + 5)
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title="Trainingstage & Dauer" sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}>
      <div className="stepper">
        <span className="stepper-label">Minuten je Einheit</span>
        <div className="stepper-row">
          <button className="btn btn-secondary btn-icon" aria-label="Kürzer" onClick={() => setMin(profile.minutes - 5)}><Icon name="minus" size={20} /></button>
          <output className="stepper-val">{profile.minutes}</output>
          <button className="btn btn-secondary btn-icon" aria-label="Länger" onClick={() => setMin(profile.minutes + 5)}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <Choices items={items} onToggle={toggle} />
      {fitting.length > 0 && <>
        <h4 className="pe-section">Aufteilung</h4>
        <Choices items={splits.map(x => ({ ...x, on: (chosen ?? 'auto') === x.id }))} onToggle={id => pickSplit(id)} />
      </>}
    </Sheet>
  )
}

/** Zusammenfassungen für die Profil-Zeilen */
export function profileSummary(t: Training) {
  const p = L.profileOf(t.ix, t.state)
  const { skills: SKILLS, splits: SPLITS } = catalogData(t.ix.catalog)
  const names = p.goals.map(g => SKILLS.find(s => s.id === g)?.name ?? g)
  return {
    goals: names.length ? names.join(' · ') : 'noch keine gewählt',
    equipment: p.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL]).filter(Boolean).join(', ') || 'nur Boden und Wand',
    days: `${L.WEEK_ORDER.filter(d => p.days.includes(d)).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || 'keine Tage'} · ca. ${p.minutes} min`
      + (SPLITS.find(x => x.id === p.split && x.themes.length === p.days.length) ? ` · ${SPLITS.find(x => x.id === p.split)!.name}` : ''),
    assessment: p.assessment ? `Kurztest vom ${L.fmtShortDate(p.assessment.date)} · wiederholen` : 'Kurztest: Startstufen aus deinen Bestwerten',
  }
}

/** Kurztest wiederholen: Werte je Test → höhere Startstufen (nie zurück), erst nach „Übernehmen“ */
export function AssessmentPage({ t, onClose, parent, onDone }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; onDone?: () => void }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...profile.assessment?.results }))
  const ASSESSMENT = catalogData(t.ix.catalog).assessment
  const changes = L.placementChanges(t.ix, t.state, placement(ASSESSMENT, t.ix.catalog, values))
  const last = profile.assessment ? `Zuletzt am ${L.fmtShortDate(profile.assessment.date)}` : 'Noch kein Kurztest'
  const sub = `${last} · Jeweils dein bester Versuch, ausgeruht. Lever stuft nur höher ein, nie zurück.`
  const fmt = (id: string, v: number) => {
    const test = ASSESSMENT.tests.find(x => x.id === id)!
    return test.unit === 'level' ? test.levels?.[v] ?? '' : test.unit === 'seconds' ? `${v} s` : String(v)
  }
  const step = (id: string) => ASSESSMENT.tests.find(x => x.id === id)!.unit === 'seconds' ? 5 : 1
  const set = (id: string, v: number) => {
    const test = ASSESSMENT.tests.find(x => x.id === id)!
    const max = test.unit === 'level' ? (test.levels?.length ?? 1) - 1 : 600
    setValues(x => ({ ...x, [id]: Math.min(max, Math.max(0, v)) }))
  }
  const apply = async () => {
    if (changes.length && !await ask({ title: 'Einstufung übernehmen?', message: changes.map(c => `${c.ladder}: Stufe ${c.from + 1} → ${c.to + 1}`).join('\n'), ok: 'Übernehmen' })) return
    if (changes.length) t.setState(st => L.withPlacement(t.ix, st, changes))
    change(p => ({ ...p, assessment: { date: t.today, results: values } }))
    ;(onDone ?? onClose)()
  }
  const cta = changes.length ? `${changes.length} ${changes.length === 1 ? 'Stufe' : 'Stufen'} übernehmen` : 'Ergebnis speichern'
  useNativeSheet(native ? {
    id: 'assessment', parent: parent?.id, title: 'Einstufung', subtitle: sub, detents: ['large'],
    blocks: [
      ...ASSESSMENT.tests.flatMap((x): NBlock[] => x.unit === 'level'
        ? [{ type: 'text', text: x.name, style: 'small' }, { type: 'segmented', id: `lvl-${x.id}`, options: (x.levels ?? []).map((l, i) => ({ id: String(i), title: l })), selected: String(values[x.id] ?? 0) }]
        : [{ type: 'stepper', id: x.id, label: x.name, value: fmt(x.id, values[x.id] ?? 0) }]),
      { type: 'section', title: changes.length ? 'Würde höher einstufen' : 'Ergebnis' },
      ...(changes.length
        ? changes.map((c): NBlock => ({ type: 'row', title: c.ladder, subtitle: `${c.fromName} → ${c.toName}`, trailing: `Stufe ${c.from + 1} → ${c.to + 1}`, symbol: 'none' }))
        : [{ type: 'text', text: 'Mit diesen Werten bleibt jede Leiter, wo sie ist.', style: 'muted' } as NBlock]),
    ],
    footer: [{ id: 'apply', title: cta, symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('lvl-')) { const [id, v] = e.id.slice(4).split(':'); set(id, Number(v)) }
    else if (e.type === 'tap' && e.id?.endsWith(':minus')) { const id = e.id.slice(0, -6); set(id, (values[id] ?? 0) - step(id)) }
    else if (e.type === 'tap' && e.id?.endsWith(':plus')) { const id = e.id.slice(0, -5); set(id, (values[id] ?? 0) + step(id)) }
    else if (e.type === 'tap' && e.id === 'apply') void apply()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title="Einstufung" sub={sub} back={parent?.title} onClose={onClose}
      footer={<button className="btn btn-primary btn-block" onClick={() => void apply()}><Icon name="check" size={18} /> {cta}</button>}>
      {ASSESSMENT.tests.map(x => x.unit === 'level' ? (
        <div key={x.id} className="as-level">
          <span className="stepper-label">{x.name}</span>
          <div className="seg pill" role="group" aria-label={x.name}>
            {(x.levels ?? []).map((l, i) => <button key={l} className={(values[x.id] ?? 0) === i ? 'on' : ''} aria-pressed={(values[x.id] ?? 0) === i} onClick={() => set(x.id, i)}>{l}</button>)}
          </div>
        </div>
      ) : (
        <div key={x.id} className="stepper">
          <span className="stepper-label">{x.name}</span>
          <div className="stepper-row">
            <button className="btn btn-secondary btn-icon" aria-label={`${x.name} verringern`} onClick={() => set(x.id, (values[x.id] ?? 0) - step(x.id))}><Icon name="minus" size={20} /></button>
            <output className="stepper-val">{fmt(x.id, values[x.id] ?? 0)}</output>
            <button className="btn btn-secondary btn-icon" aria-label={`${x.name} erhöhen`} onClick={() => set(x.id, (values[x.id] ?? 0) + step(x.id))}><Icon name="plus" size={20} /></button>
          </div>
        </div>
      ))}
      <h4 className="pe-section">{changes.length ? 'Würde höher einstufen' : 'Ergebnis'}</h4>
      {changes.length ? (
        <ul className="pe-days">
          {changes.map(c => <li key={c.pid} className="as-change"><b>{c.ladder}</b><span>{c.fromName} → {c.toName} · Stufe {c.from + 1} → {c.to + 1}</span></li>)}
        </ul>
      ) : <p className="hint">Mit diesen Werten bleibt jede Leiter, wo sie ist.</p>}
    </Sheet>
  )
}

/** Feedback senden (Push-Seite im Profil) – landet in der Datenbank, nur Admins lesen es */
export function FeedbackPage({ t, onClose, parent }: { t: Training; onClose: () => void; parent?: { id: string; title: string } }) {
  const native = useNativeShell()
  const [category, setCategory] = useState<'bug' | 'idea' | 'other'>('idea')
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | string>('idle')
  const signedIn = !!t.sync.account
  const send = async () => {
    const message = text.trim()
    if (message.length < 3 || state === 'sending') return
    setState('sending')
    try {
      await sendFeedback({ category, message, appVersion: APP_VERSION, platform: isNative() ? 'ios' : 'web' })
      setState('sent'); setText('')
    } catch (e) { setState(`Senden fehlgeschlagen: ${(e as Error).message}`) }
  }
  const sub = signedIn ? 'Fehler, Ideen, alles was auffällt – geht direkt an das Lever-Team.' : 'Zum Senden bitte im Profil anmelden.'
  const CATS = [{ id: 'bug', title: 'Fehler' }, { id: 'idea', title: 'Idee' }, { id: 'other', title: 'Sonstiges' }] as const
  const status = state === 'sent' ? 'Danke! Dein Feedback ist angekommen.' : state === 'sending' ? 'Sende …' : state !== 'idle' ? state : null
  useNativeSheet(native ? {
    id: 'feedback', parent: parent?.id, title: 'Feedback', subtitle: sub, detents: ['large'],
    blocks: signedIn ? [
      { type: 'segmented', id: 'cat', options: CATS.map(c => ({ id: c.id, title: c.title })), selected: category },
      { type: 'field', id: 'msg', label: 'Nachricht', value: text, placeholder: 'Was ist passiert, was wünschst du dir?' },
      ...(status ? [{ type: 'text', text: status, style: state.startsWith('Senden fehl') ? 'warn' : 'accent' } as NBlock] : []),
    ] : [],
    footer: signedIn ? [{ id: 'send', title: 'Senden', symbol: 'paperplane', style: 'prominent' }] : undefined,
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('cat:')) setCategory(e.id.slice(4) as typeof category)
    else if (e.type === 'text' && e.id === 'msg') { setText(String(e.value ?? '')); if (state !== 'idle' && state !== 'sending') setState('idle') }
    else if (e.type === 'tap' && e.id === 'send') void send()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title="Feedback" sub={sub} back={parent?.title} onClose={onClose}
      footer={signedIn && <button className="btn btn-primary btn-block" disabled={text.trim().length < 3 || state === 'sending'} onClick={() => void send()}>Senden</button>}>
      {signedIn && <>
        <div className="seg pill" role="group" aria-label="Art">
          {CATS.map(c => <button key={c.id} className={category === c.id ? 'on' : ''} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.title}</button>)}
        </div>
        <label className="field">Nachricht
          <textarea rows={6} maxLength={4000} value={text} placeholder="Was ist passiert, was wünschst du dir?" onChange={e => { setText(e.target.value); if (state !== 'idle' && state !== 'sending') setState('idle') }} />
        </label>
        {status && <p className={state.startsWith('Senden fehl') ? 'warn' : 'hint'} role="status">{status}</p>}
      </>}
    </Sheet>
  )
}
