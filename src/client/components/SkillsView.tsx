'use client'
/* Skills-Tab: Ziele, nächster realistischer Skill, alle Skills kompakt (Filter nach Region),
   Skill-Seite mit Progressionen, Stufen-Ansicht als Push-Seite; Grundlagen ganz unten. */
import { useMemo, useState } from 'react'
import * as L from '../logic'
import { REGIONS, type Session } from '@/domain/model'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { ask, type NBlock } from '../native'
import { GoalPicker, useProfile } from './ProfileParts'
import { catalogData } from '../data'

type Filter = 'all' | 'pull' | 'push' | 'core' | 'legs'
const FILTERS: [Filter, string][] = [['all', 'Alle'], ['pull', 'Ziehen'], ['push', 'Drücken'], ['core', 'Rumpf'], ['legs', 'Beine']]

/** Skills: deine Ziele, der realistischste nächste Skill, dann alle Skills als kompakte Liste (Filter
    nach Körperregion). Ein Skill öffnet seine Seite mit den Progressionen; Grundlagen ganz unten. */
export function SkillsView({ t, onOpen }: { t: Training; onOpen: (pid: string) => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const { skills } = catalogData(t.ix.catalog)
  const cards = useMemo(() => L.skillOverview(t.ix, t.state, t.sessions, skills), [t.ix, t.state, t.sessions, skills])
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const shown = cards.filter(c => filter === 'all' || c.region === filter)
  const inSkill = new Set(skills.flatMap(sk => [...sk.targets, ...sk.support]))
  const basics = tree.filter(p => !inSkill.has(p.pid))
  const started = cards.filter(c => c.started).length
  const detail = cards.find(c => c.skill.id === open)

  return (
    <section className="skills">
      <span className="h-date">{cards.length} Skills · {started} begonnen</span>
      <h2 className="page-title display">Skills</h2>
      <Goals t={t} onOpen={id => setOpen(id)} />

      <h3 className="pl-head display">Alle Skills</h3>
      <div className="seg pill sk-filter" role="group" aria-label="Körperregion">
        {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      <ol className="sk-list">
        {shown.map(c => (
          <li key={c.skill.id}>
            <button className={`sk-item${c.goal ? ' goal' : ''}${!c.started && c.missing.length ? ' later' : ''}`} onClick={() => setOpen(c.skill.id)}>
              <span className="sk-item-main">
                <b className="display">{c.skill.name}{c.goal && <em className="sk-badge">Ziel</em>}</b>
                <small>{c.reached ? 'erreicht' : c.started || !c.missing.length ? `${c.stage} · ${c.current}` : `fehlt noch: ${c.missing.join(', ')}`}</small>
              </span>
              <span className="sk-item-side" aria-label={`${Math.round(c.share * 100)} Prozent`}>
                <span className="goal-bar"><i style={{ width: `${Math.round(c.share * 100)}%` }} /></span>
                <small>{Math.round(c.share * 100)} %</small>
              </span>
              <Icon name="right" size={16} className="sk-chev" />
            </button>
          </li>
        ))}
      </ol>

      {basics.length > 0 && <>
        <h3 className="pl-head display">Grundlagen</h3>
        <p className="hint pl-note sk-basics-hint">Progressionen, die zu keinem Skill gehören – Kraft und Ausgleich.</p>
        <ol className="sk-list">
          {basics.map(p => (
            <li key={p.pid}>
              <button className="sk-item" onClick={() => onOpen(p.pid)}>
                <span className="sk-item-main">
                  <b className="display">{L.progressionName(t.ix, p.pid)}</b>
                  <small>{p.nodes.length === 1 ? p.step.exercise.name : `${p.step.exercise.name} · Stufe ${p.step.index + 1}/${p.step.total}`}</small>
                </span>
                <Icon name="right" size={16} className="sk-chev" />
              </button>
            </li>
          ))}
        </ol>
      </>}
      {detail && <SkillDetail t={t} card={detail} onClose={() => setOpen(null)} />}
    </section>
  )
}

/** Seite eines Skills: Weg (Ziel-Progressionen), Unterstützung, Voraussetzungen, Ziel an/aus.
    Eine Progression schiebt die Stufen-Ansicht hinein. */
function SkillDetail({ t, card, onClose }: { t: Training; card: L.SkillCard; onClose: () => void }) {
  const native = useNativeShell()
  const { change } = useProfile(t)
  const [pid, setPid] = useState<string | null>(null)
  const sk = card.skill
  const goals = L.profileOf(t.ix, t.state).goals
  const full = goals.length >= 3 && !card.goal
  const row = (id: string) => {
    const step = L.currentStep(t.ix, t.state, id)
    return { id, name: L.progressionName(t.ix, id), sub: step.total === 1 ? step.exercise.name : `${step.exercise.name} · Stufe ${step.index + 1}/${step.total}`, ex: step.exercise }
  }
  const targets = sk.targets.filter(id => t.ix.progressions.has(id)).map(row)
  const support = sk.support.filter(id => t.ix.progressions.has(id)).map(row)
  const prereqs = sk.prerequisites.filter(x => t.ix.progressions.has(x.progression)).map(x => {
    const done = L.currentStep(t.ix, t.state, x.progression).index >= x.minStep
    const name = t.ix.exercises.get(t.ix.progressions.get(x.progression)!.steps[Math.min(x.minStep, t.ix.progressions.get(x.progression)!.steps.length - 1)].exercise)?.name ?? x.progression
    return { name, done }
  })
  const sub = card.reached ? 'Erreicht' : `${Math.round(card.share * 100)} % · ${card.stage}${card.goal ? ' · dein Ziel' : ''}`
  const toggle = () => { if (!full) change(p => L.withGoal(p, sk.id, !card.goal)) }
  const cta = card.goal ? 'Als Ziel entfernen' : full ? 'Schon drei Ziele gewählt' : 'Als Ziel wählen'
  useNativeSheet(native ? {
    id: 'skill-detail', title: sk.name, subtitle: sub, detents: ['medium', 'large'],
    blocks: [
      { type: 'section', title: 'Weg zum Skill' },
      ...targets.map((x): NBlock => ({ type: 'row', id: `p:${x.id}`, title: x.name, subtitle: x.sub, clip: hasClip(x.ex.id) ? x.ex.id : undefined })),
      ...(support.length ? [{ type: 'section', title: 'Unterstützt durch' } as NBlock, ...support.map((x): NBlock => ({ type: 'row', id: `p:${x.id}`, title: x.name, subtitle: x.sub, clip: hasClip(x.ex.id) ? x.ex.id : undefined }))] : []),
      ...(prereqs.length ? [{ type: 'section', title: 'Voraussetzungen' } as NBlock,
        { type: 'text', text: prereqs.map(x => `${x.name} – ${x.done ? 'erfüllt' : 'fehlt noch'}`).join('\n'), style: 'body' } as NBlock] : []),
    ],
    footer: [{ id: 'goal', title: cta, symbol: card.goal ? 'minus' : 'plus', style: card.goal ? undefined : 'prominent' }],
  } : null, e => {
    if (e.type === 'tap' && e.id?.startsWith('p:')) setPid(e.id.slice(2))
    else if (e.type === 'tap' && e.id === 'goal') toggle()
    else if (e.type === 'dismiss') onClose()
  })
  const ladder = pid && <SkillSheet t={t} pid={pid} parent={{ id: 'skill-detail', title: sk.name }} onClose={() => setPid(null)} />
  if (native) return ladder || null
  const list = (xs: typeof targets) => (
    <ol className="sk-list">{xs.map(x => (
      <li key={x.id}><button className="sk-item" onClick={() => setPid(x.id)}>
        {hasClip(x.ex.id) && <span className="sk-thumb" aria-hidden="true"><ExerciseStill exercise={x.ex} /></span>}
        <span className="sk-item-main"><b className="display">{x.name}</b><small>{x.sub}</small></span>
        <Icon name="right" size={16} className="sk-chev" />
      </button></li>
    ))}</ol>
  )
  return (
    <>
      <Sheet large title={sk.name} sub={sub} onClose={onClose}
        footer={<button className={`btn ${card.goal ? 'btn-secondary' : 'btn-primary'} btn-block`} disabled={full} onClick={toggle}>{cta}</button>}>
        <h4 className="pe-section">Weg zum Skill</h4>
        {list(targets)}
        {support.length > 0 && <><h4 className="pe-section">Unterstützt durch</h4>{list(support)}</>}
        {prereqs.length > 0 && <>
          <h4 className="pe-section">Voraussetzungen</h4>
          <ul className="sk-prereq">{prereqs.map(x => <li key={x.name} className={x.done ? 'done' : ''}><Icon name={x.done ? 'check' : 'minus'} size={14} /> {x.name}</li>)}</ul>
        </>}
      </Sheet>
      {ladder}
    </>
  )
}

/** Leiter einer Progression als Sheet – die Liste bleibt, wo sie war */
export function SkillSheet({ t, pid, onClose, parent }: { t: Training; pid: string; onClose: () => void; parent?: { id: string; title: string } }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const p = tree.find(x => x.pid === pid)
  const native = useNativeShell()
  const region = p ? REGIONS.find(r => r.id === p.region)?.label ?? p.workout?.name ?? '' : ''
  const sub = p ? `${region} · ${L.BLOCK_LABEL[p.block]} · Stufe ${p.step.index + 1}/${p.step.total}${p.paused ? ' · pausiert' : ''}` : ''
  // Kopf nennt das Ziel der Leiter (letzte Stufe), nicht die aktuelle Übung – so sieht man, wohin es geht
  const goal = p ? L.progressionName(t.ix, p.pid) : ''
  // Stufe wechseln: wie im Technik-Sheet auch von Hand – vor dem Kriterium mit Rückfrage
  const act = (id: string) => { if (p) void switchStep(t, p, id) }
  useNativeSheet(native && p ? { id: 'skill', parent: parent?.id, title: goal, subtitle: sub, detents: ['auto', 'large'], blocks: ladderBlocks(p, t.sessions) } : null, e => {
    if (e.type === 'dismiss') onClose()
    else if (e.type === 'tap' && e.id) act(e.id)
  })
  if (!p || native) return null
  return (
    <Sheet title={goal} sub={sub} back={parent?.title} onClose={onClose}>
      <Ladder t={t} p={p} onAct={act} />
    </Sheet>
  )
}


/** Aktionen der Leiter: unlock (Kriterium erfüllt), force (vorzeitig, mit Rückfrage), back (eine Stufe zurück) */
async function switchStep(t: Training, p: L.SkillPath, action: string) {
  const to = action === 'back' ? p.step.prev : p.step.next
  if (!to) return
  if (action === 'force') {
    const at = p.step.target.unlockAt, done = p.progress?.done ?? 0
    const ok = await ask({
      title: `Jetzt zu ${to.name}?`,
      message: at == null ? 'Für diese Stufe gibt es kein festes Kriterium – wechsle, wenn sich die aktuelle sauber anfühlt.'
        : `Das Kriterium ist noch nicht erfüllt (${done} von 2 Einheiten mit allen Sätzen ≥ ${at}${p.step.exercise.unit === 'seconds' ? ' s' : ''}). Du kannst jederzeit zurück.`,
      ok: 'Wechseln',
    })
    if (!ok) return
  }
  t.setState(st => ({ ...st, current: { ...st.current, [p.pid]: to.id } }))
}

function Ladder({ t, p, onAct }: { t: Training; p: L.SkillPath; onAct: (id: string) => void }) {
  const prog = p.progress, at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const ready = !p.paused && prog?.done === 2 && !!p.step.next
  const standing = L.stepStanding(t.sessions, p.step.exercise, p.step.target, p.step.nextTarget)
  return (
    <div className="sk-ladder">
      <ol className="sk-nodes">
        {p.nodes.map((n, i) => (
          <li key={n.exercise.id} className={`sk-node ${n.state}`}>
            {hasClip(n.exercise.id) && <span className={`sk-thumb lg ${n.state}`} aria-hidden="true"><ExerciseStill exercise={n.exercise} /></span>}
            <span className="sk-dot" aria-hidden="true">
              {n.state === 'done' ? <Icon name="check" size={18} /> : n.state === 'locked' ? <Icon name="lock" size={16} /> : <span className="num">{i + 1}</span>}
            </span>
            <span className="sk-body">
              <b className="display">{n.exercise.name}</b>
              <small>
                {n.state === 'done' ? `geschafft · ${n.sessions} ${n.sessions === 1 ? 'Einheit' : 'Einheiten'}`
                  : n.state === 'current' ? `Aktuell · ${n.target.label}${standing.best ? ` · beste Einheit ${standing.best}` : ''}`
                  : i === p.nodes.length - 1 ? 'letzte Stufe dieser Progression' : 'noch gesperrt'}
              </small>
              {n.state === 'current' && !!n.exercise.cues?.length && (
                <ul className="sk-cues" aria-label="Worauf es auf dieser Stufe ankommt">{n.exercise.cues.map(c => <li key={c}>{c}</li>)}</ul>
              )}
              {n.state === 'current' && p.step.next && (
                <span className="sk-unlock">
                  {at == null ? (
                    <>
                      <span>Kein festes Kriterium – wechsle, wenn es sich sauber anfühlt.</span>
                      <button className="btn btn-secondary btn-block" onClick={() => onAct('force')}><Icon name="up" /> Zu {p.step.next.name} wechseln</button>
                    </>
                  ) : (
                    <>
                      <span>Freischalten: <b>2 Einheiten</b>, alle Sätze ≥ <b>{at}{unit}</b></span>
                      <span className="sk-segs" aria-label={`${prog?.done ?? 0} von 2 Einheiten geschafft`}>
                        <i className={(prog?.done ?? 0) >= 1 ? 'on' : ''} /><i className={(prog?.done ?? 0) >= 2 ? 'on' : ''} />
                      </span>
                      <small>{prog?.done ?? 0} von 2{standing.missing ? ` · ${standing.missing}` : ' · bereit'}</small>
                      {ready ? (
                        <button className="btn btn-primary btn-block" onClick={() => onAct('unlock')}>
                          <Icon name="up" /> {p.step.next.name} freischalten
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-block" onClick={() => onAct('force')}>
                          <Icon name="up" /> Trotzdem wechseln
                        </button>
                      )}
                    </>
                  )}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {p.step.prev && <button className="btn btn-ghost btn-block sk-back" onClick={() => onAct('back')}><Icon name="undo" /> Zurück zu {p.step.prev.name}</button>}
    </div>
  )
}

/** Leiter als Zeitleiste (nativ): Stufen an einer Linie, die aktuelle mit Bild, Fortschritt und Aktionen */
function ladderBlocks(p: L.SkillPath, sessions: Session[]): NBlock[] {
  const prog = p.progress, at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const ready = !p.paused && prog?.done === 2 && !!p.step.next
  const standing = L.stepStanding(sessions, p.step.exercise, p.step.target, p.step.nextTarget)
  const einh = (n: number) => `${n} ${n === 1 ? 'Einheit' : 'Einheiten'}`
  const nodes = p.nodes.map((n, i) => ({
    title: n.exercise.name, label: String(i + 1), state: n.state,
    clip: hasClip(n.exercise.id) ? n.exercise.id : undefined,
    subtitle: n.state === 'done' ? `geschafft · ${einh(n.sessions)}`
      : n.state === 'current' ? `Aktuell · ${n.target.label}${standing.best ? ` · beste Einheit ${standing.best}` : ''}`
      : i === p.nodes.length - 1 ? 'Das Ziel dieser Progression' : 'noch gesperrt',
  }))
  const next = p.step.next
  return [{
    type: 'track', nodes,
    criterion: !next ? 'Höchste Stufe erreicht – halte sie sauber.'
      : at == null ? 'Kein festes Kriterium – wechsle, wenn es sich sauber anfühlt.'
      : `Freischalten: 2 Einheiten in Folge, alle Sätze ≥ ${at}${unit}`,
    done: next && at != null ? prog?.done ?? 0 : undefined, total: next && at != null ? 2 : undefined,
    hint: next && at != null ? `${prog?.done ?? 0} von 2${standing.missing ? ` · ${standing.missing}` : ' · bereit'}` : undefined,
    unlock: ready ? `${next!.name} freischalten` : undefined,
    force: next && !ready ? (at == null ? `Zu ${next.name} wechseln` : 'Trotzdem wechseln →') : undefined,
    back: p.step.prev ? `Zurück zu ${p.step.prev.name}` : undefined,
  },
  // was diese Stufe ausmacht – die Clips benachbarter Stufen sehen sich oft ähnlich
  ...(p.step.exercise.cues?.length ? [
    { type: 'section', title: `Worauf es bei ${p.step.exercise.name} ankommt` } as NBlock,
    { type: 'text', text: p.step.exercise.cues.map(c => `• ${c}`).join('\n'), style: 'body' } as NBlock,
  ] : [])]
}

/** Ziele (bis zu drei Skills) mit Fortschritt, darunter der realistischste nächste Skill */
function Goals({ t, onOpen }: { t: Training; onOpen: (pid: string) => void }) {
  const { profile, change } = useProfile(t)
  const [picking, setPicking] = useState(false)
  const SKILLS = catalogData(t.ix.catalog).skills
  const goals = profile.goals.flatMap(id => {
    const skill = SKILLS.find(s => s.id === id)
    return skill ? [{ skill, p: L.goalProgress(t.ix, t.state, t.sessions, skill) }] : []
  })
  const next = L.skillChoices(t.ix, t.state, SKILLS).find(c => !c.reached && !profile.goals.includes(c.skill))
  const nextSkill = next && SKILLS.find(s => s.id === next.skill)
  const full = profile.goals.length >= 3
  return (
    <>
      <div className="pl-head-row">
        <h3 className="pl-head display">Deine Ziele</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}><Icon name={goals.length ? 'edit' : 'plus'} size={16} /> {goals.length ? 'Ändern' : 'Wählen'}</button>
      </div>
      {goals.length ? (
        <div className="pl-grid">
          {goals.map(({ skill, p }) => (
            <button key={skill.id} className="pl-card goal" onClick={() => onOpen(skill.id)}>
              <b className="display">{skill.name}</b>
              <span className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.round(p.share * 100)}%` }} /></span>
              <small>{p.stage} · {p.current}</small>
              <em>{Math.round(p.share * 100)} %</em>
            </button>
          ))}
        </div>
      ) : <p className="hint pl-note">Wähle bis zu drei Skills als Ziel – Lever richtet Vorschläge für deinen Plan danach aus.</p>}
      {next && nextSkill && (
        <div className="card sk-next">
          <span className="h-date">Realistisch als Nächstes</span>
          <b className="display">{next.name}</b>
          <p>{next.missing.length ? `Dafür fehlt noch: ${next.missing.join(', ')}.` : `Die Voraussetzungen erfüllst du – ${Math.round(next.score * 100)} % bereit.`}</p>
          <button className="btn btn-primary btn-block" disabled={full} onClick={() => change(pr => L.withGoal(pr, next.skill, true))}>
            {full ? 'Schon drei Ziele gewählt' : 'Als Ziel wählen'}
          </button>
        </div>
      )}
      {picking && <GoalPicker t={t} onClose={() => setPicking(false)} />}
    </>
  )
}
