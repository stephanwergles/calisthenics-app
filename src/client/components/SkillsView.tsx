'use client'
/* Skill-Tree: jede Progression als Leiter. Eine ist aufgeklappt (Standard: die mit dem kürzesten
   Weg zur nächsten Stufe), alle anderen als kompakte Zeilen mit Stufen-Balken. */
import { useMemo, useState } from 'react'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'

export function SkillsView({ t, toTop }: { t: Training; toTop: () => void }) {
  const tree = useMemo(() => L.skillTree(t.ix, t.state, t.sessions), [t.ix, t.state, t.sessions])
  const best = useMemo(() => L.nextSkills(t.ix, t.state, t.sessions, 1)[0]?.pid, [t.ix, t.state, t.sessions])
  const [open, setOpen] = useState<string | undefined>(undefined)
  const selected = open ?? best ?? tree[0]?.pid
  const current = tree.find(p => p.pid === selected)
  const unlocked = tree.reduce((n, p) => n + p.step.index, 0)
  const groups = tree.reduce<{ workout: L.SkillPath['workout']; paths: L.SkillPath[] }[]>((acc, p) => {
    const g = acc.find(x => x.workout.id === p.workout.id)
    if (g) g.paths.push(p); else acc.push({ workout: p.workout, paths: [p] })
    return acc
  }, [])

  return (
    <section className="skills">
      <span className="h-date">{tree.length} Progressionen · {unlocked} {unlocked === 1 ? 'Stufe' : 'Stufen'} freigeschaltet</span>
      <h2 className="page-title display">Skill-Tree</h2>
      {current && <Ladder key={current.pid} t={t} p={current} />}
      {groups.map(g => (
        <div key={g.workout.id} className="sk-group">
          <h3 className="pg-day"><span className="display">{g.workout.name}</span><span>{g.workout.focus}</span></h3>
          {g.paths.map(p => <Row key={p.pid} p={p} on={p.pid === selected} onOpen={() => { setOpen(p.pid); toTop() }} />)}
        </div>
      ))}
    </section>
  )
}

function Row({ p, on, onOpen }: { p: L.SkillPath; on: boolean; onOpen: () => void }) {
  return (
    <button className={`sk-row${p.paused ? ' paused' : ''}${on ? ' on' : ''}`} onClick={onOpen} aria-pressed={on}>
      <span className="sk-row-main">
        <b className="display">{p.step.exercise.name}</b>
        <small>{p.step.next ? `nächste: ${p.step.next.name}` : p.nodes.length > 1 ? 'höchste Stufe erreicht' : 'eine Stufe'}{p.paused ? ' · pausiert' : ''}</small>
      </span>
      <span className="sk-steps" aria-label={`Stufe ${p.step.index + 1} von ${p.step.total}`}>
        {p.nodes.map((n, i) => <i key={i} className={n.state} />)}
      </span>
    </button>
  )
}

function Ladder({ t, p }: { t: Training; p: L.SkillPath }) {
  const prog = p.progress, at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const ready = !p.paused && prog?.done === 2 && !!p.step.next
  return (
    <div className="sk-ladder">
      <div className="sk-head">
        <span className="display">{p.workout.name} · {L.BLOCK_LABEL[p.block]}</span>
        <span className="sk-level">Stufe {p.step.index + 1}/{p.step.total}{p.paused ? ' · pausiert' : ''}</span>
      </div>
      <ol className="sk-nodes">
        {p.nodes.map((n, i) => (
          <li key={n.exercise.id} className={`sk-node ${n.state}`}>
            <span className="sk-dot" aria-hidden="true">
              {n.state === 'done' ? <Icon name="check" size={18} /> : n.state === 'locked' ? <Icon name="lock" size={16} /> : <span className="num">{i + 1}</span>}
            </span>
            <span className="sk-body">
              <b className="display">{n.exercise.name}</b>
              <small>
                {n.state === 'done' ? `geschafft · ${n.sessions} ${n.sessions === 1 ? 'Einheit' : 'Einheiten'}`
                  : n.state === 'current' ? `aktuell · Ziel ${n.target.label}${n.sessions ? ` · ${n.sessions} ${n.sessions === 1 ? 'Einheit' : 'Einheiten'}` : ''}`
                  : i === p.nodes.length - 1 ? 'letzte Stufe dieser Leiter' : 'noch gesperrt'}
              </small>
              {n.state === 'current' && p.step.next && (
                <span className="sk-unlock">
                  {at == null ? (
                    <span>Kein festes Kriterium – wechsle über „Technik“, wenn es sich sauber anfühlt.</span>
                  ) : (
                    <>
                      <span>Freischalten: <b>2 Einheiten</b>, alle Sätze ≥ <b>{at}{unit}</b></span>
                      <span className="sk-segs" aria-label={`${prog?.done ?? 0} von 2 Einheiten geschafft`}>
                        <i className={(prog?.done ?? 0) >= 1 ? 'on' : ''} /><i className={(prog?.done ?? 0) >= 2 ? 'on' : ''} />
                      </span>
                      <small>{prog?.done ?? 0} von 2{prog && prog.done < 2 && prog.sessions > 0 && prog.missing > 0
                        ? ` · zuletzt ${prog.missing} ${prog.missing === 1 ? 'Satz' : 'Sätze'} unter ${at}${unit}` : ''}</small>
                      {ready && (
                        <button className="btn btn-primary btn-block" onClick={() => t.setState(st => ({ ...st, current: { ...st.current, [p.pid]: p.step.next!.id } }))}>
                          <Icon name="up" /> {p.step.next.name} freischalten
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
    </div>
  )
}
