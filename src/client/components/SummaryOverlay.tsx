'use client'
/* Abschluss nach „Training beenden“: Kennzahlen, neue Bestwerte, Vergleich je Übung mit dem letzten Mal. */
import { useMemo, useState } from 'react'
import type { Session } from '@/domain/model'
import * as L from '../logic'
import type { Training } from '../useTraining'
import { Icon } from './Icon'

export function SummaryOverlay({ t, session, onClose }: { t: Training; session: Session; onClose: () => void }) {
  const sum = useMemo(() => L.sessionSummary(t.ix, t.sessions, session), [t.ix, t.sessions, session])
  const w = t.ix.workouts.get(session.workout)
  const [note, setNote] = useState(session.note ?? '')
  const [noteOpen, setNoteOpen] = useState(false)
  const max = Math.max(1, ...sum.compare.flatMap(c => [c.before, c.now]))
  const close = () => {
    if ((L.cleanNote(note) ?? '') !== (session.note ?? '')) t.updateToday(s => L.withNote(s, note))
    onClose()
  }
  const h = Math.floor(sum.durationSec / 3600), m = Math.round((sum.durationSec % 3600) / 60)

  return (
    <div className="summary" role="dialog" aria-modal="true" aria-label="Trainingsabschluss">
      <div className="sm-scroll">
        <span className="h-date">{L.fmtDate(session.date)} · {w ? `${w.name} · ${w.focus}` : session.workout}</span>
        <h2 className="display sm-title">Stark<span className="accent">.</span></h2>

        <div className="sm-stats">
          <div><span className="num">{h ? `${h}:${String(m).padStart(2, '0')}` : m}</span><small>{h ? 'Stunden' : m === 1 ? 'Minute' : 'Minuten'}</small></div>
          <div><span className="num">{sum.sets}</span><small>Sätze</small></div>
          <div><span className="num">{sum.reps}</span><small>Wdh.{sum.repsDelta ? <> · <b className={sum.repsDelta > 0 ? 'up' : ''}>{sum.repsDelta > 0 ? '+' : '−'}{Math.abs(sum.repsDelta)}</b></> : ''}</small></div>
        </div>

        {sum.records.length > 0 && (
          <section className="sm-block">
            <h3 className="display">Neue Bestwerte</h3>
            {sum.records.map(r => (
              <div key={`${r.exercise.id}-${r.kind}`} className="sm-record">
                <span className="sm-badge"><Icon name="trophy" size={20} /></span>
                <span className="sm-record-text">
                  <b>{r.exercise.name}</b>
                  <small>{r.kind === 'weight'
                    ? (r.before ? `Zusatzgewicht +${r.value} kg · vorher +${r.before} kg` : `Erstmals mit +${r.value} kg`)
                    : `Bester Satz ${r.value}${r.exercise.unit === 'seconds' ? ' s' : ''} · vorher ${r.before}`}</small>
                </span>
                <span className="num sm-record-value">{r.kind === 'weight' ? `+${r.value}` : r.value}</span>
              </div>
            ))}
          </section>
        )}

        {sum.compare.length > 0 && (
          <section className="sm-block">
            <h3 className="display">Zum letzten Mal</h3>
            <ul className="sm-compare">
              {sum.compare.map(c => {
                const d = c.now - c.before
                return (
                  <li key={c.exercise.id}>
                    <span className="sm-name">{c.exercise.name}</span>
                    <span className="sm-bars" aria-label={`letztes Mal ${c.before}, heute ${c.now}`}>
                      <i className="before" style={{ width: `${(c.before / max) * 100}%` }} />
                      <i className="now" style={{ width: `${(c.now / max) * 100}%` }} />
                    </span>
                    <span className={`num sm-delta${d > 0 ? ' up' : ''}`}>{d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="sm-legend"><span><i className="before" />Letztes Mal</span><span><i className="now" />Heute</span></p>
          </section>
        )}

        {noteOpen && (
          <label className="field">
            <span className="field-label"><Icon name="note" size={16} /> Notiz zur Einheit</span>
            <textarea rows={3} maxLength={L.NOTE_MAX} value={note} autoFocus placeholder="Wie war’s?" onChange={e => setNote(e.target.value)} />
          </label>
        )}
      </div>
      <div className="f-actions sm-actions">
        <button className={`btn btn-secondary f-notebtn${noteOpen ? ' on' : ''}`} aria-label="Notiz zur Einheit" aria-pressed={noteOpen} onClick={() => setNoteOpen(o => !o)}>
          <Icon name="note" size={22} />
        </button>
        <button className="btn btn-primary grow f-cta" onClick={close}>Fertig</button>
      </div>
    </div>
  )
}
