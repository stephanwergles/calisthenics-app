'use client'
/* Skill-Tree: jede Progression als kompakte Zeile mit Stufen-Balken, nach Körperregion gruppiert.
   Antippen öffnet die Leiter als Sheet. */
import { useMemo } from 'react'
import * as L from '../logic'
import { REGIONS, type Session } from '@/domain/model'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { ExerciseStill, hasClip } from './ExerciseMedia'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { ask, type NBlock } from '../native'

export function SkillsView({ t, onOpen }: { t: Training; onOpen: (pid: string) => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const unlocked = tree.reduce((n, p) => n + p.step.index, 0)
  // nach Körperregion – Workouts sind Planung, der Skill-Tree zeigt den Körper
  const groups = [...REGIONS, { id: undefined, label: 'Weitere', detail: '' }]
    .map(r => ({ ...r, paths: tree.filter(p => p.region === r.id) }))
    .filter(g => g.paths.length)

  return (
    <section className="skills">
      <span className="h-date">{tree.length} Progressionen · {unlocked} {unlocked === 1 ? 'Stufe' : 'Stufen'} freigeschaltet</span>
      <h2 className="page-title display">Skill-Tree</h2>
      {groups.map(g => (
        <div key={g.label} className="sk-group">
          <h3 className="pg-day"><span className="display">{g.label}</span><span>{g.detail}</span></h3>
          {g.paths.map(p => <Row key={p.pid} p={p} onOpen={() => onOpen(p.pid)} />)}
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
  const region = p ? REGIONS.find(r => r.id === p.region)?.label ?? p.workout.name : ''
  const sub = p ? `${region} · ${L.BLOCK_LABEL[p.block]} · Stufe ${p.step.index + 1}/${p.step.total}${p.paused ? ' · pausiert' : ''}` : ''
  // Kopf nennt das Ziel der Leiter (letzte Stufe), nicht die aktuelle Übung – so sieht man, wohin es geht
  const goal = p ? p.nodes[p.nodes.length - 1].exercise.name : ''
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

function Row({ p, onOpen }: { p: L.SkillPath; onOpen: () => void }) {
  return (
    <button className={`sk-row${p.paused ? ' paused' : ''}`} onClick={onOpen}>
      {hasClip(p.step.exercise.id) && <span className="sk-thumb" aria-hidden="true"><ExerciseStill exercise={p.step.exercise} /></span>}
      <span className="sk-row-main">
        {/* Titel = Ziel der Leiter, darunter wo man gerade steht (wie im Leiter-Sheet) */}
        <b className="display">{p.nodes[p.nodes.length - 1].exercise.name}</b>
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
  const standing = L.stepStanding(t.sessions, p.step.exercise, p.step.target)
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
                  : i === p.nodes.length - 1 ? 'letzte Stufe dieser Leiter' : 'noch gesperrt'}
              </small>
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
  const standing = L.stepStanding(sessions, p.step.exercise, p.step.target)
  const einh = (n: number) => `${n} ${n === 1 ? 'Einheit' : 'Einheiten'}`
  const nodes = p.nodes.map((n, i) => ({
    title: n.exercise.name, label: String(i + 1), state: n.state,
    clip: hasClip(n.exercise.id) ? n.exercise.id : undefined,
    subtitle: n.state === 'done' ? `geschafft · ${einh(n.sessions)}`
      : n.state === 'current' ? `Aktuell · ${n.target.label}${standing.best ? ` · beste Einheit ${standing.best}` : ''}`
      : i === p.nodes.length - 1 ? 'Das Ziel dieser Leiter' : 'noch gesperrt',
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
  }]
}
