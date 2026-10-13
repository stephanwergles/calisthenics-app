'use client'
/* Skill-Tree: jede Progression als kompakte Zeile mit Stufen-Balken, nach Körperregion gruppiert.
   Antippen öffnet die Leiter als Sheet. */
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

export function SkillsView({ t, onOpen }: { t: Training; onOpen: (pid: string) => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const unlocked = tree.reduce((n, p) => n + p.step.index, 0)
  // nach Skill: deine Ziele zuerst, dann die übrigen Skills; was zu keinem Skill gehört, nach Körperregion
  const { skills } = catalogData(t.ix.catalog)
  const goals = L.profileOf(t.ix, t.state).goals
  const seen = new Set<string>()
  const bySkill = [...skills].sort((a, b) => Number(goals.includes(b.id)) - Number(goals.includes(a.id)))
    .map(sk => ({
      key: sk.id, label: sk.name, detail: goals.includes(sk.id) ? 'Dein Ziel' : 'Skill',
      // Ziel-Progressionen immer beim Skill, Hilfs-Progressionen nur beim ersten Skill
      paths: [...sk.targets.map(pid => ({ pid, always: true })), ...sk.support.map(pid => ({ pid, always: false }))].flatMap(({ pid, always }) => {
        const p = tree.find(x => x.pid === pid)
        if (!p || (!always && seen.has(pid))) return []
        seen.add(pid)
        return [p]
      }).filter((p, i, all) => all.findIndex(x => x.pid === p.pid) === i),
    })).filter(g => g.paths.length)
  const groups = [...bySkill, ...[...REGIONS, { id: undefined, label: 'Weitere', detail: '' }]
    .map(r => ({ key: r.label, label: `${r.label}`, detail: 'Grundlagen', paths: tree.filter(p => p.region === r.id && !seen.has(p.pid)) }))
    .filter(g => g.paths.length)]

  return (
    <section className="skills">
      <span className="h-date">{tree.length} Progressionen · {unlocked} {unlocked === 1 ? 'Stufe' : 'Stufen'} freigeschaltet</span>
      <h2 className="page-title display">Skills</h2>
      <Goals t={t} onOpen={onOpen} />
      <h3 className="pl-head display">Alle Progressionen</h3>
      {groups.map(g => (
        <div key={g.key} className="sk-group">
          <h3 className="pg-day"><span className="display">{g.label}</span><span>{g.detail}</span></h3>
          {g.paths.map(p => <Row key={p.pid} p={p} name={L.progressionName(t.ix, p.pid)} onOpen={() => onOpen(p.pid)} />)}
        </div>
      ))}
    </section>
  )
}

/** Leiter einer Progression als Sheet – die Liste bleibt, wo sie war */
export function SkillSheet({ t, pid, onClose }: { t: Training; pid: string; onClose: () => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const p = tree.find(x => x.pid === pid)
  const native = useNativeShell()
  const region = p ? REGIONS.find(r => r.id === p.region)?.label ?? p.workout?.name ?? '' : ''
  const sub = p ? `${region} · ${L.BLOCK_LABEL[p.block]} · Stufe ${p.step.index + 1}/${p.step.total}${p.paused ? ' · pausiert' : ''}` : ''
  // Kopf nennt das Ziel der Leiter (letzte Stufe), nicht die aktuelle Übung – so sieht man, wohin es geht
  const goal = p ? L.progressionName(t.ix, p.pid) : ''
  // Stufe wechseln: wie im Technik-Sheet auch von Hand – vor dem Kriterium mit Rückfrage
  const act = (id: string) => { if (p) void switchStep(t, p, id) }
  useNativeSheet(native && p ? { id: 'skill', title: goal, subtitle: sub, detents: ['auto', 'large'], blocks: ladderBlocks(p, t.sessions) } : null, e => {
    if (e.type === 'dismiss') onClose()
    else if (e.type === 'tap' && e.id) act(e.id)
  })
  if (!p || native) return null
  return (
    <Sheet title={goal} sub={sub} onClose={onClose}>
      <Ladder t={t} p={p} onAct={act} />
    </Sheet>
  )
}

function Row({ p, name, onOpen }: { p: L.SkillPath; name: string; onOpen: () => void }) {
  return (
    <button className={`sk-row${p.paused ? ' paused' : ''}`} onClick={onOpen}>
      {hasClip(p.step.exercise.id) && <span className="sk-thumb" aria-hidden="true"><ExerciseStill exercise={p.step.exercise} /></span>}
      <span className="sk-row-main">
        {/* Titel = Name der Progression, darunter wo man gerade steht */}
        <b className="display">{name}</b>
        <small>{p.nodes.length === 1 ? 'eine Stufe'
          : !p.step.next ? 'Ziel erreicht'
          : `${p.step.exercise.name} · Stufe ${p.step.index + 1}/${p.step.total}`}{p.paused ? ' · pausiert' : ''}</small>
      </span>
      <span className="sk-steps" aria-label={`Stufe ${p.step.index + 1} von ${p.step.total}`}>
        {p.nodes.map((n, i) => <i key={i} className={n.state} />)}
      </span>
    </button>
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
            <button key={skill.id} className="pl-card goal" onClick={() => p.pid && onOpen(p.pid)}>
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
