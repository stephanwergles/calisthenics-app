'use client'
/* Skill-Tree: jede Progression als kompakte Zeile mit Stufen-Balken, nach Körperregion gruppiert.
   Antippen öffnet die Leiter als Sheet. */
import { useMemo } from 'react'
import * as L from '../logic'
import { REGIONS } from '@/domain/model'
import type { Training } from '../useTraining'
import { Icon } from './Icon'
import { Sheet } from './Sheets'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import type { NBlock } from '../native'

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
  useNativeSheet(native && p ? { id: 'skill', title: p.step.exercise.name, subtitle: sub, detents: ['auto', 'large'], blocks: ladderBlocks(p) } : null, e => {
    if (e.type === 'dismiss') onClose()
    else if (e.type === 'tap' && e.id === 'unlock' && p?.step.next) t.setState(st => ({ ...st, current: { ...st.current, [p.pid]: p.step.next!.id } }))
  })
  if (!p || native) return null
  return (
    <Sheet title={p.step.exercise.name} sub={sub} onClose={onClose}>
      <Ladder t={t} p={p} />
    </Sheet>
  )
}

function Row({ p, onOpen }: { p: L.SkillPath; onOpen: () => void }) {
  return (
    <button className={`sk-row${p.paused ? ' paused' : ''}`} onClick={onOpen}>
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

/** Leiter als native Bausteine – gleiche Aussagen wie <Ladder> */
function ladderBlocks(p: L.SkillPath): NBlock[] {
  const prog = p.progress, at = p.step.target.unlockAt
  const unit = p.step.exercise.unit === 'seconds' ? ' s' : ''
  const ready = !p.paused && prog?.done === 2 && !!p.step.next
  const out: NBlock[] = []
  p.nodes.forEach((n, i) => {
    out.push({
      type: 'ladder', title: n.exercise.name, label: String(i + 1), state: n.state,
      subtitle: n.state === 'done' ? `geschafft · ${n.sessions} ${n.sessions === 1 ? 'Einheit' : 'Einheiten'}`
        : n.state === 'current' ? `aktuell · Ziel ${n.target.label}${n.sessions ? ` · ${n.sessions} ${n.sessions === 1 ? 'Einheit' : 'Einheiten'}` : ''}`
        : i === p.nodes.length - 1 ? 'letzte Stufe dieser Leiter' : 'noch gesperrt',
    })
    if (n.state !== 'current' || !p.step.next) return
    if (at == null) { out.push({ type: 'text', style: 'muted', text: 'Kein festes Kriterium – wechsle über „Technik“, wenn es sich sauber anfühlt.' }); return }
    out.push({ type: 'text', text: `Freischalten: 2 Einheiten in Folge, alle Sätze ≥ ${at}${unit}` })
    out.push({ type: 'segments', done: prog?.done ?? 0, total: 2,
      label: `${prog?.done ?? 0} von 2${prog && prog.done < 2 && prog.sessions > 0 && prog.missing > 0 ? ` · zuletzt ${prog.missing} ${prog.missing === 1 ? 'Satz' : 'Sätze'} unter ${at}${unit}` : ''}` })
    if (ready) out.push({ type: 'button', id: 'unlock', title: `${p.step.next.name} freischalten`, symbol: 'arrow.up', style: 'prominent' })
  })
  return out
}
