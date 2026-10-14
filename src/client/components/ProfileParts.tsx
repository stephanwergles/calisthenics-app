'use client'
/* Profil-Eingaben als Sheets: Ziele, Ausrüstung, Trainingstage & Dauer. Gespeichert im
   Trainingsstand (state.profile, synchronisiert). Ändern den Plan nicht – sie sind Eingaben
   für Vorschläge, die erst nach Bestätigung gelten. */
import type { Equipment, Exercise, Profile, Region, Weekday } from '@/domain/model'
import { placement } from '@/domain/assessment'
import { catalogData } from '@/core/data'
import { useState } from 'react'
import { ask, isNative } from '../native'
import { sendFeedback } from '@/core/api'
import { APP_VERSION } from '../version'
import * as L from '@/core/logic'
import type { Training } from '@/core/useTraining'
import type { NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { t as tr, tn, type Key, type LocaleChoice } from '@/core/i18n'
import { toast } from '@/core/toast'


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
  c.reached ? tr('profile.goals.reached') : c.missing.length ? tr('profile.goals.missing', { list: c.missing.join(', ') }) : tr(`profile.goals.tier.${c.tier}`)

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

/* Ziele und Ausrüstung als Kacheln: Bild (Clip-Standbild der Zielposition), Name, ein Satz
   Erklärung, Stand. Nativ der Baustein „tiles“, im Web dieselbe Kachel als Button. */
type Tile = { id: string; title: string; subtitle?: string; detail?: string; accent?: boolean; exercise?: Exercise; symbol?: string; on: boolean }
const blurb = (key: string) => { const s = tr(key as Key); return s === key ? undefined : s }

function Tiles({ items, onToggle }: { items: Tile[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <ul className="tiles">
      {items.map(x => (
        <li key={x.id}>
          <button className={`tile${x.on ? ' on' : ''}`} aria-pressed={x.on} onClick={() => onToggle(x.id, !x.on)}>
            <span className="tile-art">{x.exercise && hasClip(x.exercise.id) ? <ExerciseStill exercise={x.exercise} /> : <Icon name="training" size={30} />}</span>
            <span className="tile-check" aria-hidden="true">{x.on && <Icon name="check" size={14} />}</span>
            <b className="display">{x.title}</b>
            {x.subtitle && <small>{x.subtitle}</small>}
            {x.detail && <em className={x.accent ? 'accent' : undefined}>{x.detail}</em>}
          </button>
        </li>
      ))}
    </ul>
  )
}
const nativeTiles = (items: Tile[]): NBlock => ({ type: 'tiles', tiles: items.map(({ exercise, ...x }) =>
  ({ ...x, clip: exercise && hasClip(exercise.id) ? exercise.id : undefined, symbol: exercise ? undefined : x.symbol })) })

/** Bild eines Skills: die schwerste Stufe seiner Ziel-Progressionen, die einen Clip hat (sonst die letzte) */
function skillExercise(ix: Training['ix'], targets: string[]): Exercise | undefined {
  const steps = targets.flatMap(pid => ix.progressions.get(pid)?.steps ?? [])
  const withClip = [...steps].reverse().find(st => hasClip(st.exercise))
  return ix.exercises.get((withClip ?? steps[steps.length - 1])?.exercise ?? '')
}
const REGION_ORDER = ['pull', 'push', 'legs', 'core']

export function GoalPicker({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const { skills } = catalogData(t.ix.catalog)
  const choices = L.skillChoices(t.ix, t.state, skills, catalogData(t.ix.catalog).meta)
  const tiles = choices.map((c): Tile & { region: string } => {
    const skill = skills.find(x => x.id === c.skill)!
    return {
      id: c.skill, title: c.name, subtitle: blurb(`profile.goals.blurb.${c.skill}`), detail: choiceSub(c), accent: !c.reached && c.tier === 'next',
      exercise: skillExercise(t.ix, skill.targets), on: profile.goals.includes(c.skill),
      region: t.ix.progressions.get(skill.targets[0])?.region ?? 'core',
    }
  })
  // nach Körperbereich gruppiert, innerhalb „realistisch als Nächstes“ zuerst (Reihenfolge aus skillChoices)
  const groups = [...new Set([...REGION_ORDER, ...tiles.map(x => x.region)])]
    .map(r => ({ region: r, items: tiles.filter(x => x.region === r) })).filter(g => g.items.length)
  const sub = tr('profile.goals.sub', { n: profile.goals.length })
  const toggle = (id: string, on: boolean) => {
    if (on && profile.goals.length >= L.MAX_GOALS) { toast(tr('profile.goals.full')); return }
    change(p => L.withGoal(p, id, on))
  }
  useNativeSheet(native ? {
    id: 'goals', parent: parent?.id, footer: footerOf(next), title: tr('profile.row.goals'), subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'text', text: tr('profile.goals.pickHint'), style: 'muted' },
      ...groups.flatMap((g): NBlock[] => [{ type: 'section', title: L.regionLabel(g.region as Region) }, nativeTiles(g.items)]),
    ],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'next') next?.onNext()
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={tr('profile.row.goals')} sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}>
      <p className="hint">{tr('profile.goals.pickHint')}</p>
      {groups.map(g => <section key={g.region}><h4 className="pe-section">{L.regionLabel(g.region as Region)}</h4><Tiles items={g.items} onToggle={toggle} /></section>)}
    </Sheet>
  )
}

/** Bild je Gerät: Standbild einer Übung, die es zeigt; ohne Clip ein Symbol */
const GEAR_ART: Partial<Record<Equipment, string>> = {
  bar: 'pull-up', rings: 'ring-push-up', parallettes: 'l-sit-parallettes', 'dip-bars': 'dip', band: 'muscle-up-band',
  box: 'pike-push-up-elevated', weight: 'dip-weighted', pole: '',
}
export function EquipmentSheet({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = (Object.entries(L.EQUIPMENT_LABEL) as [Equipment, string][]).map(([id, title]): Tile => ({
    id, title, subtitle: blurb(`profile.equipment.blurb.${id}`), exercise: t.ix.exercises.get(GEAR_ART[id] ?? ''), symbol: 'figure.cross.training',
    on: profile.equipment.includes(id),
  }))
  const sub = tr('profile.equipment.sub')
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, equipment: on ? [...new Set([...p.equipment, id as Equipment])] : p.equipment.filter(e => e !== id) }))
  useNativeSheet(native ? {
    id: 'equipment', parent: parent?.id, footer: footerOf(next), title: tr('profile.row.equipment'), subtitle: sub, detents: ['large'],
    blocks: [nativeTiles(items)],
  } : null, e => {
    if (e.type === 'tap' && e.id === 'next') next?.onNext()
    else if (e.type === 'toggle' && e.id) toggle(e.id, !!e.value)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet large title={tr('profile.row.equipment')} sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}><Tiles items={items} onToggle={toggle} /></Sheet>
}

const THEMES = ['full', 'pull', 'push', 'lower', 'upper'] as const
type Theme = (typeof THEMES)[number]

export function DaysSheet({ t, onClose, parent, next }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; next?: Next }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const items = L.WEEK_ORDER.map(d => ({ id: d, title: L.WEEKDAY_LONG[d], on: profile.days.includes(d) }))
  const sub = tr('profile.days.sub')
  const toggle = (id: string, on: boolean) => change(p => ({ ...p, days: L.WEEK_ORDER.filter(d => (d === id ? on : p.days.includes(d))) as Weekday[] }))
  const setMin = (m: number) => change(p => ({ ...p, minutes: Math.min(180, Math.max(30, m)) }))
  // Aufteilung: Vorlagen mit so vielen Themen wie Tagen, oder automatisch
  const fitting = catalogData(t.ix.catalog).splits.filter(x => x.themes.length === profile.days.length)
  const chosen = fitting.some(x => x.id === profile.split) ? profile.split : undefined
  // Klartext je Vorlage: was an den Tagen drankommt (Themen-IDs → verständliche Namen)
  const themeName = (id: string) => (THEMES.includes(id as Theme) ? tr(`profile.days.theme.${id as Theme}`) : id)
  const explain = (x: (typeof fitting)[number]) => new Set(x.themes.map(th => th.id)).size === 1
    ? tr('profile.days.same', { theme: themeName(x.themes[0].id) })
    : x.themes.map(th => themeName(th.id)).join(' · ')
  // was „Lever entscheidet“ gerade wählen würde (nur mit Zielen bekannt)
  const autoId = L.generatorInput(t.ix, { ...t.state, profile: { ...profile, split: undefined } }, catalogData(t.ix.catalog).skills, fitting)?.split
  const autoName = fitting.find(x => x.id === autoId)?.name
  const splits = [{ id: 'auto', title: tr('profile.days.auto'), sub: autoName ? tr('profile.days.autoNow', { name: autoName }) : tr('profile.days.autoSub') },
    ...fitting.map(x => ({ id: x.id, title: x.name, sub: explain(x) }))]
  const pickSplit = (id: string) => change(p => { const { split: _, ...rest } = p; return id === 'auto' ? rest : { ...rest, split: id } })
  useNativeSheet(native ? {
    id: 'days', parent: parent?.id, footer: footerOf(next), title: tr('profile.row.days'), subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stepper', id: 'min', label: tr('profile.days.minutes'), value: String(profile.minutes) },
      ...items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
      ...(fitting.length ? [
        { type: 'section', title: tr('profile.days.split') } as NBlock,
        { type: 'text', text: tr('profile.days.splitIntro'), style: 'muted' } as NBlock,
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
    <Sheet title={tr('profile.row.days')} sub={sub} back={parent?.title} onClose={onClose} footer={webFooter(next)}>
      <div className="stepper">
        <span className="stepper-label">{tr('profile.days.minutes')}</span>
        <div className="stepper-row">
          <button className="btn btn-secondary btn-icon" aria-label={tr('profile.days.shorter')} onClick={() => setMin(profile.minutes - 5)}><Icon name="minus" size={20} /></button>
          <output className="stepper-val">{profile.minutes}</output>
          <button className="btn btn-secondary btn-icon" aria-label={tr('profile.days.longer')} onClick={() => setMin(profile.minutes + 5)}><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <Choices items={items} onToggle={toggle} />
      {fitting.length > 0 && <>
        <h4 className="pe-section">{tr('profile.days.split')}</h4>
        <p className="hint">{tr('profile.days.splitIntro')}</p>
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
    goals: names.length ? names.join(' · ') : tr('profile.goals.none'),
    equipment: p.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL]).filter(Boolean).join(', ') || tr('profile.equipment.none'),
    days: tr('profile.days.summary', { days: L.WEEK_ORDER.filter(d => p.days.includes(d)).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || tr('profile.days.none'), min: p.minutes })
      + (SPLITS.find(x => x.id === p.split && x.themes.length === p.days.length) ? ` · ${SPLITS.find(x => x.id === p.split)!.name}` : ''),
    assessment: p.assessment ? tr('profile.assessment.summaryDone', { date: L.fmtShortDate(p.assessment.date) }) : tr('profile.assessment.summaryNone'),
  }
}

/** Kurztest wiederholen: Werte je Test → höhere Startstufen (nie zurück), erst nach „Übernehmen“ */
export function AssessmentPage({ t, onClose, parent, onDone }: { t: Training; onClose: () => void; parent?: { id: string; title: string }; onDone?: () => void }) {
  const native = useNativeShell()
  const { profile, change } = useProfile(t)
  const [values, setValues] = useState<Record<string, number>>(() => ({ ...profile.assessment?.results }))
  const ASSESSMENT = catalogData(t.ix.catalog).assessment
  const changes = L.placementChanges(t.ix, t.state, placement(ASSESSMENT, t.ix.catalog, values))
  const last = profile.assessment ? tr('profile.assessment.last', { date: L.fmtShortDate(profile.assessment.date) }) : tr('profile.assessment.never')
  const sub = tr('profile.assessment.sub', { last })
  const fmt = (id: string, v: number) => {
    const test = ASSESSMENT.tests.find(x => x.id === id)!
    return test.unit === 'level' ? test.levels?.[v] ?? '' : test.unit === 'seconds' ? tr('profile.assessment.seconds', { v }) : String(v)
  }
  const step = (id: string) => ASSESSMENT.tests.find(x => x.id === id)!.unit === 'seconds' ? 5 : 1
  const set = (id: string, v: number) => {
    const test = ASSESSMENT.tests.find(x => x.id === id)!
    const max = test.unit === 'level' ? (test.levels?.length ?? 1) - 1 : 600
    setValues(x => ({ ...x, [id]: Math.min(max, Math.max(0, v)) }))
  }
  /** raise = höhere Stufen übernehmen; sonst nur die Werte merken (Plan bleibt) */
  const apply = async (raise: boolean) => {
    const up = raise ? changes : []
    if (up.length && !await ask({ title: tr('profile.assessment.askTitle'), message: tr('profile.assessment.askMessage', { list: up.map(c => tr('profile.assessment.change', { ladder: c.ladder, fromName: c.fromName, toName: c.toName })).join('\n') }), ok: tn('profile.assessment.apply', up.length) })) return
    if (up.length) t.setState(st => L.withPlacement(t.ix, st, up))
    change(p => ({ ...p, assessment: { date: t.today, results: values } }))
    toast(up.length ? tr('common.toast.assessmentApplied') : tr('common.toast.saved'), 'success')
    // im Profil bleibt die Seite offen (weiter testen); nur das Onboarding geht zum nächsten Schritt
    onDone?.()
  }
  const cta = changes.length ? tn('profile.assessment.apply', changes.length) : tr('profile.assessment.save')
  // Tests mit Stufen (Pistol): Auswahl-Liste mit Erklärung je Stufe statt gequetschtem Segment-Schalter
  const levelItems = (x: (typeof ASSESSMENT.tests)[number]) => (x.levels ?? []).map((title, i) => ({
    id: String(i), title: title.charAt(0).toUpperCase() + title.slice(1), sub: blurb(`profile.assessment.levelHint.${x.id}.${i}`), on: (values[x.id] ?? 0) === i,
  }))
  useNativeSheet(native ? {
    id: 'assessment', parent: parent?.id, title: tr('profile.row.assessment'), subtitle: sub, detents: ['large'],
    blocks: [
      ...ASSESSMENT.tests.flatMap((x): NBlock[] => x.unit === 'level'
        ? [{ type: 'text', text: x.name, style: 'small' }, ...levelItems(x).map((l): NBlock => ({ type: 'check', style: 'select', id: `lvl-${x.id}:${l.id}`, title: l.title, subtitle: l.sub, on: l.on }))]
        : [{ type: 'stepper', id: x.id, label: x.name, value: fmt(x.id, values[x.id] ?? 0) }]),
      { type: 'section', title: changes.length ? tr('profile.assessment.wouldRaise') : tr('profile.assessment.result') },
      ...(changes.length ? [
        { type: 'text', text: tr('profile.assessment.raiseIntro'), style: 'muted' } as NBlock,
        { type: 'list', rows: changes.map(c => ({ title: c.ladder, subtitle: `${tr('profile.assessment.now', { name: c.fromName })}\n${tr('profile.assessment.next', { name: c.toName })}`, trailing: tr('profile.assessment.stage', { from: c.from + 1, to: c.to + 1 }), symbol: 'arrow.up.circle.fill' })) } as NBlock,
      ] : [{ type: 'text', text: tr('profile.assessment.unchanged'), style: 'muted' } as NBlock]),
    ],
    footer: changes.length
      ? [{ id: 'apply', title: cta, symbol: 'arrow.up', style: 'prominent' }, { id: 'save', title: tr('profile.assessment.saveOnly') }]
      : [{ id: 'save', title: cta, symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    // Stufe wählen: auch ein Tipp auf die gewählte bleibt Auswahl (kein Abwählen)
    if (e.type === 'toggle' && e.id?.startsWith('lvl-')) { const [id, v] = e.id.slice(4).split(':'); set(id, Number(v)) }
    else if (e.type === 'tap' && e.id?.endsWith(':minus')) { const id = e.id.slice(0, -6); set(id, (values[id] ?? 0) - step(id)) }
    else if (e.type === 'tap' && e.id?.endsWith(':plus')) { const id = e.id.slice(0, -5); set(id, (values[id] ?? 0) + step(id)) }
    else if (e.type === 'tap' && e.id === 'apply') void apply(true)
    else if (e.type === 'tap' && e.id === 'save') void apply(false)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet large title={tr('profile.row.assessment')} sub={sub} back={parent?.title} onClose={onClose}
      footer={changes.length
        ? <div className="sg-foot">
            <button className="btn btn-primary btn-block" onClick={() => void apply(true)}><Icon name="up" size={18} /> {cta}</button>
            <button className="btn btn-secondary btn-block" onClick={() => void apply(false)}>{tr('profile.assessment.saveOnly')}</button>
          </div>
        : <button className="btn btn-primary btn-block" onClick={() => void apply(false)}><Icon name="check" size={18} /> {cta}</button>}>
      {ASSESSMENT.tests.map(x => x.unit === 'level' ? (
        <div key={x.id} className="as-level">
          <span className="stepper-label">{x.name}</span>
          <Choices items={levelItems(x)} onToggle={id => set(x.id, Number(id))} />
        </div>
      ) : (
        <div key={x.id} className="stepper">
          <span className="stepper-label">{x.name}</span>
          <div className="stepper-row">
            <button className="btn btn-secondary btn-icon" aria-label={tr('profile.assessment.less', { name: x.name })} onClick={() => set(x.id, (values[x.id] ?? 0) - step(x.id))}><Icon name="minus" size={20} /></button>
            <output className="stepper-val">{fmt(x.id, values[x.id] ?? 0)}</output>
            <button className="btn btn-secondary btn-icon" aria-label={tr('profile.assessment.more', { name: x.name })} onClick={() => set(x.id, (values[x.id] ?? 0) + step(x.id))}><Icon name="plus" size={20} /></button>
          </div>
        </div>
      ))}
      <h4 className="pe-section">{changes.length ? tr('profile.assessment.wouldRaise') : tr('profile.assessment.result')}</h4>
      {changes.length ? <>
        <p className="hint as-intro">{tr('profile.assessment.raiseIntro')}</p>
        <ul className="pe-days">
          {changes.map(c => <li key={c.pid} className="as-change"><b>{c.ladder}</b>
            <span>{tr('profile.assessment.now', { name: c.fromName })}<br />{tr('profile.assessment.next', { name: c.toName })} · {tr('profile.assessment.stage', { from: c.from + 1, to: c.to + 1 })}</span></li>)}
        </ul>
      </> : <p className="hint">{tr('profile.assessment.unchanged')}</p>}
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
      toast(tr('common.toast.feedbackSent'), 'success')
    } catch (e) { setState(`fail:${(e as Error).message}`) }
  }
  const sub = signedIn ? tr('profile.feedback.sub') : tr('profile.feedback.signInFirst')
  const CATS = (['bug', 'idea', 'other'] as const).map(id => ({ id, title: tr(`profile.feedback.cat.${id}`) }))
  const failed = state.startsWith('fail:')
  const status = state === 'sent' ? tr('profile.feedback.sent') : state === 'sending' ? tr('profile.feedback.sending') : failed ? tr('profile.feedback.failed', { msg: state.slice(5) }) : null
  useNativeSheet(native ? {
    id: 'feedback', parent: parent?.id, title: tr('profile.feedback.title'), subtitle: sub, detents: ['large'],
    blocks: signedIn ? [
      { type: 'segmented', id: 'cat', options: CATS.map(c => ({ id: c.id, title: c.title })), selected: category },
      { type: 'field', id: 'msg', label: tr('profile.feedback.message'), value: text, placeholder: tr('profile.feedback.placeholder') },
      ...(status ? [{ type: 'text', text: status, style: failed ? 'warn' : 'accent' } as NBlock] : []),
    ] : [],
    footer: signedIn ? [{ id: 'send', title: tr('common.send'), symbol: 'paperplane', style: 'prominent' }] : undefined,
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('cat:')) setCategory(e.id.slice(4) as typeof category)
    else if (e.type === 'text' && e.id === 'msg') { setText(String(e.value ?? '')); if (state !== 'idle' && state !== 'sending') setState('idle') }
    else if (e.type === 'tap' && e.id === 'send') void send()
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return (
    <Sheet title={tr('profile.feedback.title')} sub={sub} back={parent?.title} onClose={onClose}
      footer={signedIn && <button className="btn btn-primary btn-block" disabled={text.trim().length < 3 || state === 'sending'} onClick={() => void send()}>{tr('common.send')}</button>}>
      {signedIn && <>
        <div className="seg pill" role="group" aria-label={tr('profile.feedback.kind')}>
          {CATS.map(c => <button key={c.id} className={category === c.id ? 'on' : ''} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.title}</button>)}
        </div>
        <label className="field">{tr('profile.feedback.message')}
          <textarea rows={6} maxLength={4000} value={text} placeholder={tr('profile.feedback.placeholder')} onChange={e => { setText(e.target.value); if (state !== 'idle' && state !== 'sending') setState('idle') }} />
        </label>
        {status && <p className={failed ? 'warn' : 'hint'} role="status">{status}</p>}
      </>}
    </Sheet>
  )
}

/** Sprache (Push-Seite im Profil): Systemsprache, Deutsch oder Englisch – gilt pro Gerät */
export type { LocaleChoice }
export function LanguagePage({ choice, onChange, onClose, parent }: { choice: LocaleChoice; onChange: (l: LocaleChoice) => void; onClose: () => void; parent?: { id: string; title: string } }) {
  const native = useNativeShell()
  const items = (['system', 'de', 'en'] as const).map(id => ({ id, title: tr(`profile.language.${id}`), on: choice === id }))
  const sub = tr('profile.language.sub')
  useNativeSheet(native ? {
    id: 'language', parent: parent?.id, title: tr('profile.language.title'), subtitle: sub, detents: ['medium', 'large'],
    blocks: items.map((x): NBlock => ({ type: 'check', style: 'select', id: x.id, title: x.title, on: x.on })),
  } : null, e => {
    if (e.type === 'toggle' && (e.id === 'system' || e.id === 'de' || e.id === 'en')) onChange(e.id)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return null
  return <Sheet title={tr('profile.language.title')} sub={sub} back={parent?.title} onClose={onClose}><Choices items={items} onToggle={id => onChange(id as LocaleChoice)} /></Sheet>
}
