'use client'
/* Skills-Tab: Ziele, nächster realistischer Skill, alle Skills kompakt (Filter nach Region),
   Skill-Seite mit Progressionen, Stufen-Ansicht als Push-Seite; Grundlagen ganz unten. */
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Session } from '@/domain/model'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { ask, type NBlock } from '../native'
import { GoalPicker, useProfile } from './ProfileParts'
import { catalogData } from '../data'
import { t as tr, tn, getLocale } from '../i18n'

type Filter = 'all' | 'pull' | 'push' | 'core' | 'legs'
const FILTERS: Filter[] = ['all', 'pull', 'push', 'core', 'legs']
const filterLabel = (f: Filter) => (f === 'all' ? tr('skills.all') : L.regionLabel(f))

/** Skills: deine Ziele, der realistischste nächste Skill, dann alle Skills als kompakte Liste (Filter
    nach Körperregion). Ein Skill öffnet seine Seite mit den Progressionen; Grundlagen ganz unten. */
export function SkillsView({ t, onOpen }: { t: Training; onOpen: (pid: string) => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, getLocale()])
  const { skills } = catalogData(t.ix.catalog)
  const cards = useMemo(() => L.skillOverview(t.ix, t.state, t.sessions, skills, catalogData(t.ix.catalog).meta), [t.ix, t.state, t.sessions, skills, getLocale()])
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const shown = cards.filter(c => filter === 'all' || c.region === filter)
  const inSkill = new Set(skills.flatMap(sk => [...sk.targets, ...sk.support]))
  const basics = tree.filter(p => !inSkill.has(p.pid))
  const started = cards.filter(c => c.started).length
  const detail = cards.find(c => c.skill.id === open)

  return (
    <section className="skills">
      <span className="h-date">{tr('skills.count', { n: cards.length, started })}</span>
      <h2 className="page-title display">{tr('skills.title')}</h2>
      <Goals t={t} onOpen={id => setOpen(id)} />

      <h3 className="pl-head display">{tr('skills.allSkills')}</h3>
      <div className="seg pill sk-filter" role="group" aria-label={tr('skills.region')}>
        {FILTERS.map(k => <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{filterLabel(k)}</button>)}
      </div>
      <ol className="sk-list">
        {shown.map(c => (
          <li key={c.skill.id}>
            <button className={`sk-item${c.goal ? ' goal' : ''}${!c.started && c.missing.length ? ' later' : ''}`} onClick={() => setOpen(c.skill.id)}>
              <span className="sk-item-main">
                <b className="display">{c.skill.name}{c.goal && <em className="sk-badge">{tr('skills.goalBadge')}</em>}</b>
                <small>{c.reached ? tr('skills.reached') : c.started || !c.missing.length ? `${c.stage} · ${c.current}` : tr('skills.missing', { list: c.missing.join(', ') })}</small>
              </span>
              <span className="sk-item-side" aria-label={tr('skills.percentLabel', { n: Math.round(c.share * 100) })}>
                <span className="goal-bar"><i style={{ width: `${Math.round(c.share * 100)}%` }} /></span>
                <small>{tr('skills.percent', { n: Math.round(c.share * 100) })}</small>
              </span>
              <Icon name="right" size={16} className="sk-chev" />
            </button>
          </li>
        ))}
      </ol>

      {basics.length > 0 && <>
        <h3 className="pl-head display">{tr('skills.basics')}</h3>
        <p className="hint pl-note sk-basics-hint">{tr('skills.basicsHint')}</p>
        <ol className="sk-list">
          {basics.map(p => (
            <li key={p.pid}>
              <button className="sk-item" onClick={() => onOpen(p.pid)}>
                <span className="sk-item-main">
                  <b className="display">{L.progressionName(t.ix, p.pid)}</b>
                  <small>{p.nodes.length === 1 ? p.step.exercise.name : `${p.step.exercise.name} · ${tr('logic.stage', { i: p.step.index + 1, n: p.step.total })}`}</small>
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
    return { id, name: L.progressionName(t.ix, id), sub: step.total === 1 ? step.exercise.name : `${step.exercise.name} · ${tr('logic.stage', { i: step.index + 1, n: step.total })}`, ex: step.exercise }
  }
  const targets = sk.targets.filter(id => t.ix.progressions.has(id)).map(row)
  const support = sk.support.filter(id => t.ix.progressions.has(id)).map(row)
  const prereqs = sk.prerequisites.filter(x => t.ix.progressions.has(x.progression)).map(x => {
    const done = L.currentStep(t.ix, t.state, x.progression).index >= x.minStep
    const name = t.ix.exercises.get(t.ix.progressions.get(x.progression)!.steps[Math.min(x.minStep, t.ix.progressions.get(x.progression)!.steps.length - 1)].exercise)?.name ?? x.progression
    return { name, done }
  })
  const sub = card.reached ? tr('skills.reachedTitle') : `${tr('skills.percent', { n: Math.round(card.share * 100) })} · ${card.stage}${card.goal ? tr('skills.yourGoal') : ''}`
  const toggle = () => { if (!full) change(p => L.withGoal(p, sk.id, !card.goal)) }
  const cta = card.goal ? tr('skills.removeGoal') : full ? tr('skills.goalsFull') : tr('skills.setGoal')
  useNativeSheet(native ? {
    id: 'skill-detail', title: sk.name, subtitle: sub, detents: ['medium', 'large'],
    blocks: [
      { type: 'section', title: tr('skills.path') },
      ...targets.map((x): NBlock => ({ type: 'row', id: `p:${x.id}`, title: x.name, subtitle: x.sub, clip: hasClip(x.ex.id) ? x.ex.id : undefined })),
      ...(support.length ? [{ type: 'section', title: tr('skills.supportedBy') } as NBlock, ...support.map((x): NBlock => ({ type: 'row', id: `p:${x.id}`, title: x.name, subtitle: x.sub, clip: hasClip(x.ex.id) ? x.ex.id : undefined }))] : []),
      ...(prereqs.length ? [{ type: 'section', title: tr('skills.prerequisites') } as NBlock,
        { type: 'text', text: prereqs.map(x => tr(x.done ? 'skills.prereqDone' : 'skills.prereqMissing', { name: x.name })).join('\n'), style: 'body' } as NBlock] : []),
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
        <h4 className="pe-section">{tr('skills.path')}</h4>
        {list(targets)}
        {support.length > 0 && <><h4 className="pe-section">{tr('skills.supportedBy')}</h4>{list(support)}</>}
        {prereqs.length > 0 && <>
          <h4 className="pe-section">{tr('skills.prerequisites')}</h4>
          <ul className="sk-prereq">{prereqs.map(x => <li key={x.name} className={x.done ? 'done' : ''}><Icon name={x.done ? 'check' : 'minus'} size={14} /> {x.name}</li>)}</ul>
        </>}
      </Sheet>
      {ladder}
    </>
  )
}

/** Leiter einer Progression als Sheet – die Liste bleibt, wo sie war */
export function SkillSheet({ t, pid, onClose, parent }: { t: Training; pid: string; onClose: () => void; parent?: { id: string; title: string } }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions, getLocale()])
  const p = tree.find(x => x.pid === pid)
  const native = useNativeShell()
  const region = p ? (p.region ? L.regionLabel(p.region) : p.workout?.name ?? '') : ''
  const sub = p ? `${region} · ${L.BLOCK_LABEL[p.block]} · ${tr('logic.stage', { i: p.step.index + 1, n: p.step.total })}${p.paused ? tr('skills.paused') : ''}` : ''
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
      title: tr('skills.forceTitle', { name: to.name }),
      message: at == null ? tr('skills.forceNoCriterion')
        : tr('skills.forceNotMet', { done, at, unit: p.step.exercise.unit === 'seconds' ? ' s' : '' }),
      ok: tr('skills.switch'),
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
                {n.state === 'done' ? tn('skills.done', n.sessions)
                  : n.state === 'current' ? tr('skills.current', { target: n.target.label, best: standing.best ? tr('skills.bestSession', { best: standing.best }) : '' })
                  : i === p.nodes.length - 1 ? tr('skills.lastStep') : tr('skills.locked')}
              </small>
              {n.state === 'current' && !!n.exercise.cues?.length && (
                <ul className="sk-cues" aria-label={tr('skills.cuesLabel')}>{n.exercise.cues.map(c => <li key={c}>{c}</li>)}</ul>
              )}
              {n.state === 'current' && p.step.next && (
                <span className="sk-unlock">
                  {at == null ? (
                    <>
                      <span>{tr('skills.noCriterion')}</span>
                      <button className="btn btn-secondary btn-block" onClick={() => onAct('force')}><Icon name="up" /> {tr('skills.switchTo', { name: p.step.next.name })}</button>
                    </>
                  ) : (
                    <>
                      <span>{tr('skills.unlockPrefix')}<b>{tr('skills.unlockSessions')}</b>{tr('skills.unlockAllSets')}<b>{at}{unit}</b></span>
                      <span className="sk-segs" aria-label={tr('skills.progressLabel', { n: prog?.done ?? 0 })}>
                        <i className={(prog?.done ?? 0) >= 1 ? 'on' : ''} /><i className={(prog?.done ?? 0) >= 2 ? 'on' : ''} />
                      </span>
                      <small>{tr('skills.progressOf', { n: prog?.done ?? 0 })}{standing.missing ? ` · ${standing.missing}` : tr('skills.ready')}</small>
                      {ready ? (
                        <button className="btn btn-primary btn-block" onClick={() => onAct('unlock')}>
                          <Icon name="up" /> {tr('skills.unlock', { name: p.step.next.name })}
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-block" onClick={() => onAct('force')}>
                          <Icon name="up" /> {tr('skills.forceSwitch')}
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
      {p.step.prev && <button className="btn btn-ghost btn-block sk-back" onClick={() => onAct('back')}><Icon name="undo" /> {tr('skills.backTo', { name: p.step.prev.name })}</button>}
    </div>
  )
}

/** Leiter als Zeitleiste (nativ): Stufen an einer Linie, die aktuelle mit Bild, Fortschritt und Aktionen */
function ladderBlocks(p: L.SkillPath, sessions: Session[]): NBlock[] {
  const prog = p.progress, at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const ready = !p.paused && prog?.done === 2 && !!p.step.next
  const standing = L.stepStanding(sessions, p.step.exercise, p.step.target, p.step.nextTarget)
  const nodes = p.nodes.map((n, i) => ({
    title: n.exercise.name, label: String(i + 1), state: n.state,
    clip: hasClip(n.exercise.id) ? n.exercise.id : undefined,
    subtitle: n.state === 'done' ? tn('skills.done', n.sessions)
      : n.state === 'current' ? tr('skills.current', { target: n.target.label, best: standing.best ? tr('skills.bestSession', { best: standing.best }) : '' })
      : i === p.nodes.length - 1 ? tr('skills.finalStep') : tr('skills.locked'),
  }))
  const next = p.step.next
  return [{
    type: 'track', nodes,
    criterion: !next ? tr('skills.topStep')
      : at == null ? tr('skills.noCriterion')
      : tr('skills.unlockCriterion', { at, unit }),
    done: next && at != null ? prog?.done ?? 0 : undefined, total: next && at != null ? 2 : undefined,
    hint: next && at != null ? `${tr('skills.progressOf', { n: prog?.done ?? 0 })}${standing.missing ? ` · ${standing.missing}` : tr('skills.ready')}` : undefined,
    unlock: ready ? tr('skills.unlock', { name: next!.name }) : undefined,
    force: next && !ready ? (at == null ? tr('skills.switchTo', { name: next.name }) : tr('skills.forceSwitchArrow')) : undefined,
    back: p.step.prev ? tr('skills.backTo', { name: p.step.prev.name }) : undefined,
  },
  // was diese Stufe ausmacht – die Clips benachbarter Stufen sehen sich oft ähnlich
  ...(p.step.exercise.cues?.length ? [
    { type: 'section', title: tr('skills.cuesFor', { name: p.step.exercise.name }) } as NBlock,
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
  const next = L.skillChoices(t.ix, t.state, SKILLS, catalogData(t.ix.catalog).meta).find(c => !c.reached && !profile.goals.includes(c.skill))
  const nextSkill = next && SKILLS.find(s => s.id === next.skill)
  const full = profile.goals.length >= 3
  return (
    <>
      <div className="pl-head-row">
        <h3 className="pl-head display">{tr('skills.yourGoals')}</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}><Icon name={goals.length ? 'edit' : 'plus'} size={16} /> {goals.length ? tr('skills.change') : tr('skills.choose')}</button>
      </div>
      {goals.length ? (
        <div className="pl-grid">
          {goals.map(({ skill, p }) => (
            <button key={skill.id} className="pl-card goal" onClick={() => onOpen(skill.id)}>
              <b className="display">{skill.name}</b>
              <span className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.round(p.share * 100)}%` }} /></span>
              <small>{p.stage} · {p.current}</small>
              <em>{tr('skills.percent', { n: Math.round(p.share * 100) })}</em>
            </button>
          ))}
        </div>
      ) : <p className="hint pl-note">{tr('skills.goalsHint')}</p>}
      {next && nextSkill && (
        <div className="card sk-next">
          <span className="h-date">{tr('skills.nextUp')}</span>
          <b className="display">{next.name}</b>
          <p>{next.missing.length ? tr('skills.nextMissing', { list: next.missing.join(', ') }) : tr('skills.nextReady', { n: Math.round(next.score * 100) })}</p>
          <button className="btn btn-primary btn-block" disabled={full} onClick={() => change(pr => L.withGoal(pr, next.skill, true))}>
            {full ? tr('skills.goalsFull') : tr('skills.setGoal')}
          </button>
        </div>
      )}
      {picking && <GoalPicker t={t} onClose={() => setPicking(false)} />}
    </>
  )
}
