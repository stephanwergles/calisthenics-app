'use client'
/* Abschluss nach „Training beenden“: Kennzahlen, neue Bestwerte, Vergleich je Übung mit dem letzten Mal. */
import { useMemo, useState } from 'react'
import type { Session } from '@/domain/model'
import * as L from '@/core/logic'
import type { Training } from '@/core/useTraining'
import { Icon } from './Icon'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import type { NBlock } from '../native'
import { t as tr, tn, getLocale } from '@/core/i18n'

export function SummaryOverlay({ t, session, onClose }: { t: Training; session: Session; onClose: () => void }) {
  const sum = useMemo(() => L.sessionSummary(t.ix, t.sessions, session), [t.ix, t.sessions, session, getLocale()])
  const w = t.ix.workouts.get(session.workout)
  const [note, setNote] = useState(session.note ?? '')
  const [noteOpen, setNoteOpen] = useState(false)
  const max = Math.max(1, ...sum.compare.flatMap(c => [c.before, c.now]))
  const close = () => {
    if ((L.cleanNote(note) ?? '') !== (session.note ?? '')) t.updateToday(s => L.withNote(s, note))
    onClose()
  }
  const h = Math.floor(sum.durationSec / 3600), m = Math.round((sum.durationSec % 3600) / 60)
  const sub = `${L.fmtDate(session.date)} · ${w ? `${w.name} · ${w.focus}` : session.workout}`

  // iOS-App: als natives Sheet (Fertig/Wegwischen speichert die Notiz)
  const native = useNativeShell()
  const noteRef = { current: note }
  useNativeSheet(native ? {
    id: 'summary', title: `${tr('training.strong')}.`, subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stats', items: [
        { value: h ? `${h}:${String(m).padStart(2, '0')}` : String(m), label: h ? tr('training.summary.hours') : tn('training.summary.minutes', m), accent: true },
        { value: String(sum.sets), label: tn('training.summary.sets', sum.sets) },
        { value: String(sum.reps), label: tr('training.unitReps'), delta: sum.repsDelta ? `${sum.repsDelta > 0 ? '+' : '−'}${Math.abs(sum.repsDelta)}` : undefined },
      ] },
      ...(sum.records.length ? [{ type: 'section', title: tr('training.summary.records') } as NBlock] : []),
      ...sum.records.map((r): NBlock => ({
        type: 'record', title: r.exercise.name, value: r.kind === 'weight' ? `+${r.value}` : String(r.value),
        subtitle: r.kind === 'weight' ? (r.before ? tr('training.summary.recordWeight', { value: r.value, before: r.before }) : tr('training.summary.recordWeightFirst', { value: r.value }))
          : tr('training.summary.recordBest', { value: `${r.value}${r.exercise.unit === 'seconds' ? ' s' : ''}`, before: r.before }),
      })),
      ...(sum.compare.length ? [{ type: 'section', title: tr('training.summary.compare') } as NBlock, { type: 'text', style: 'small', text: tr('training.summary.legendNative') } as NBlock] : []),
      ...sum.compare.map((c): NBlock => {
        const d = c.now - c.before
        return { type: 'compare', title: c.exercise.name, before: c.before, now: c.now, max, delta: `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}` }
      }),
      { type: 'field', id: 'note', label: tr('training.noteSession'), value: session.note ?? '', placeholder: tr('training.notePlaceholder') },
    ],
    footer: [{ id: 'done', title: tr('training.done'), symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.type === 'text') { noteRef.current = String(e.value ?? ''); setNote(noteRef.current) }
    else if (e.type === 'dismiss' || e.id === 'done') {
      if ((L.cleanNote(noteRef.current) ?? '') !== (session.note ?? '')) t.updateToday(s => L.withNote(s, noteRef.current))
      onClose()
    }
  })
  if (native) return null

  return (
    <div className="summary" role="dialog" aria-modal="true" aria-label={tr('training.summary.label')}>
      <div className="sm-scroll">
        <span className="h-date">{L.fmtDate(session.date)} · {w ? `${w.name} · ${w.focus}` : session.workout}</span>
        <h2 className="display sm-title">{tr('training.strong')}<span className="accent">.</span></h2>

        <div className="sm-stats">
          <div><span className="num">{h ? `${h}:${String(m).padStart(2, '0')}` : m}</span><small>{h ? tr('training.summary.hours') : tn('training.summary.minutes', m)}</small></div>
          <div><span className="num">{sum.sets}</span><small>{tr('training.summary.sets.other')}</small></div>
          <div><span className="num">{sum.reps}</span><small>{tr('training.unitReps')}{sum.repsDelta ? <> · <b className={sum.repsDelta > 0 ? 'up' : ''}>{sum.repsDelta > 0 ? '+' : '−'}{Math.abs(sum.repsDelta)}</b></> : ''}</small></div>
        </div>

        {sum.records.length > 0 && (
          <section className="sm-block">
            <h3 className="display">{tr('training.summary.records')}</h3>
            {sum.records.map(r => (
              <div key={`${r.exercise.id}-${r.kind}`} className="sm-record">
                <span className="sm-badge"><Icon name="trophy" size={20} /></span>
                <span className="sm-record-text">
                  <b>{r.exercise.name}</b>
                  <small>{r.kind === 'weight'
                    ? (r.before ? tr('training.summary.recordWeight', { value: r.value, before: r.before }) : tr('training.summary.recordWeightFirst', { value: r.value }))
                    : tr('training.summary.recordBest', { value: `${r.value}${r.exercise.unit === 'seconds' ? ' s' : ''}`, before: r.before })}</small>
                </span>
                <span className="num sm-record-value">{r.kind === 'weight' ? `+${r.value}` : r.value}</span>
              </div>
            ))}
          </section>
        )}

        {sum.compare.length > 0 && (
          <section className="sm-block">
            <h3 className="display">{tr('training.summary.compare')}</h3>
            <ul className="sm-compare">
              {sum.compare.map(c => {
                const d = c.now - c.before
                return (
                  <li key={c.exercise.id}>
                    <span className="sm-name">{c.exercise.name}</span>
                    <span className="sm-bars" aria-label={tr('training.summary.compareBars', { before: c.before, now: c.now })}>
                      <i className="before" style={{ width: `${(c.before / max) * 100}%` }} />
                      <i className="now" style={{ width: `${(c.now / max) * 100}%` }} />
                    </span>
                    <span className={`num sm-delta${d > 0 ? ' up' : ''}`}>{d > 0 ? '+' : d < 0 ? '−' : '±'}{Math.abs(d)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="sm-legend"><span><i className="before" />{tr('training.summary.lastTime')}</span><span><i className="now" />{tr('training.summary.today')}</span></p>
          </section>
        )}

        {noteOpen && (
          <label className="field">
            <span className="field-label"><Icon name="note" size={16} /> {tr('training.noteSession')}</span>
            <textarea rows={3} maxLength={L.NOTE_MAX} value={note} autoFocus placeholder={tr('training.notePlaceholder')} onChange={e => setNote(e.target.value)} />
          </label>
        )}
      </div>
      <div className="f-actions sm-actions">
        <button className={`btn btn-secondary f-notebtn${noteOpen ? ' on' : ''}`} aria-label={tr('training.noteSession')} aria-pressed={noteOpen} onClick={() => setNoteOpen(o => !o)}>
          <Icon name="note" size={22} />
        </button>
        <button className="btn btn-primary grow f-cta" onClick={close}>{tr('training.done')}</button>
      </div>
    </div>
  )
}
