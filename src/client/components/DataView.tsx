'use client'
import { useState } from 'react'
import type { Training } from '../useTraining'
import { APP_VERSION } from '../version'
import { Icon } from './Icon'
import { ask } from '../native'
import { HEALTH_CONSENT, PRIVACY_URL } from '../consent'
import { Wordmark } from './LeverMark'
import { intl, t as tr, tn } from '../i18n'
import { toast } from '../toast'

const fmtSync = (iso: string | null) => {
  if (!iso) return tr('profile.sync.never')
  const d = new Date(iso)
  const same = d.toDateString() === new Date().toDateString()
  return same ? tr('profile.sync.today', { time: d.toLocaleTimeString(intl(), { hour: '2-digit', minute: '2-digit' }) })
    : d.toLocaleString(intl(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Abgleich auf Knopfdruck – mit Rückmeldung als Toast (automatische Läufe bleiben still) */
export async function manualSync(t: Training) {
  const r = await t.syncNow()
  if (r === 'ok') toast(tr('common.toast.synced'), 'success')
  else if (r === 'error') toast(tr('common.toast.syncFailed'), 'error')
}

/** Sync-Zustand in einem Satz (Profil-Kopf, Konto-Karte) */
export const syncStatus = (s: Training['sync']) => s.phase === 'syncing' ? tr('profile.sync.syncing')
  : s.phase === 'offline' ? tr('profile.sync.offline')
  : s.phase === 'error' ? tr('profile.sync.error', { msg: s.error ?? tr('profile.sync.unknown') })
  : s.pending ? tn('profile.sync.pending', s.pending)
  : tr('profile.sync.done')

function Account({ t }: { t: Training }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const s = t.sync

  if (s.account) {
    const status = syncStatus(s)
    return (
      <div className="card">
        <h2>{tr('profile.sync.title')}</h2>
        <p className="meta">{tr('profile.sync.signedInAs')} <b>{s.account.email}</b></p>
        <p className={s.phase === 'error' ? 'warn' : 'hint'}>{status} {tr('profile.sync.last', { when: fmtSync(s.lastSync) })}</p>
        {s.phase !== 'error' && s.error && <p className="warn">{tr('profile.sync.rejected', { msg: s.error })}</p>}
        {s.consentMissing && (
          <div className="consent-missing">
            <p className="warn">{tr('profile.consentPaused')}</p>
            <button className="btn btn-primary btn-block" onClick={() => void t.acceptHealthConsent().catch(e => alert((e as Error).message))}>{HEALTH_CONSENT.ok}</button>
          </div>
        )}
        <div className="row-btns">
          <button className="btn btn-secondary grow" disabled={s.phase === 'syncing'} aria-busy={s.phase === 'syncing'} onClick={() => void manualSync(t)}>
            <Icon name="sync" size={18} className={s.phase === 'syncing' ? 'spin' : undefined} /> {tr('profile.syncNow')}
          </button>
          <button className="btn btn-ghost" onClick={async () => { if (await ask({ title: tr('profile.signOutAsk.title'), message: tr('profile.signOutAsk.message'), ok: tr('profile.signOut') })) void t.signOut() }}>{tr('profile.signOut')}</button>
        </div>
        <button className="btn btn-danger btn-block account-delete" onClick={async () => {
          if (!await ask({ title: tr('profile.deleteAsk.title'), message: tr('profile.deleteAsk.message', { email: s.account!.email }), ok: tr('profile.deleteAccount'), destructive: true })) return
          try { await t.deleteAccount() } catch (e) { alert(tr('profile.deleteFailed', { msg: (e as Error).message })) }
        }}><Icon name="trash" size={18} /> {tr('profile.deleteAccount')}</button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try { await t.signIn(email.trim(), password, agree); setPassword('') }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <form className="card" onSubmit={e => void submit(e)}>
      <h2>{tr('profile.sync.title')}</h2>
      <p className="hint">
        {s.account === undefined && s.phase === 'offline' ? tr('profile.offlineSignIn') : ''}
        {tr('profile.signInHint')} {tr('profile.firstUpload')}
      </p>
      <label className="field">{tr('profile.email')}
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="field">{tr('profile.password')}
        <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <label className="consent-check">
        <input type="checkbox" required checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>{HEALTH_CONSENT.short} <a href={PRIVACY_URL} target="_blank" rel="noopener">{tr('common.privacy')}</a></span>
      </label>
      {err && <p className="warn">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || !agree}>{busy ? tr('profile.signingIn') : tr('profile.signIn')}</button>
    </form>
  )
}

/** Inhalt des Profils (im Web als Sheet; embedded = ohne eigene Seitenüberschrift) */
export function DataView({ t, embedded }: { t: Training; embedded?: boolean }) {
  const [msg, setMsg] = useState<string[] | null>(null)
  const sets = t.sessions.reduce((n, s) => n + s.sets.length, 0)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const v1 = JSON.parse(await file.text())
      if (!v1 || typeof v1.log !== 'object') throw new Error(tr('profile.v1.notV1'))
      if (!await ask({ title: tr('profile.v1.askTitle'), message: tr('profile.v1.askMessage'), ok: tr('common.apply') })) return
      const r = await t.importV1(v1)
      setMsg([
        tr('profile.v1.imported', { sessions: r.sessions, sets: r.sets, activities: r.activities }),
        ...(r.dropped.length ? [tr('profile.v1.dropped', { n: r.dropped.length })] : []),
        ...r.warnings.map(w => tr('profile.v1.hint1', { msg: w })),
      ])
    } catch (e) {
      setMsg([tr('profile.v1.failed', { msg: (e as Error).message })])
    }
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(t.exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `calisthenics-v2-${t.today}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="data">
      {!embedded && <>
        <span className="h-date">{!t.sync.account ? tr('profile.localOnly') : t.sync.phase === 'error' ? tr('profile.sync.headError') : t.sync.pending ? tr('profile.sync.headPending') : tr('profile.sync.headSynced')}</span>
        <h2 className="page-title display">{tr('profile.dataTitle')}</h2>
      </>}
      <div className="card hv-month">
        <div className="hv-stats" aria-label={tr('profile.stats.label')}>
          <div><span className="num">{t.sessions.length}</span><small>{tr('profile.stats.sessions')}</small></div>
          <div><span className="num">{sets}</span><small>{tr('profile.stats.sets')}</small></div>
          <div><span className="num">{t.activities.length}</span><small>{tr('profile.stats.cardio')}</small></div>
        </div>
        {!t.persistent && <p className="warn">{tr('profile.notPersistent')}</p>}
      </div>
      <Account t={t} />
      <div className="card">
        <h2>{tr('profile.v1.title')}</h2>
        <p className="hint">{tr('profile.v1.hint')}</p>
        <label className="btn btn-secondary btn-block">
          {tr('profile.v1.pick')}
          <input type="file" accept="application/json,.json" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {msg && <ul className="result">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </div>
      <div className="card">
        <h2>{tr('profile.backup')}</h2>
        <button className="btn btn-secondary btn-block" onClick={download}>{tr('profile.export')}</button>
        <a className="btn btn-ghost btn-block" href="/admin">{tr('profile.manageCatalog')} <Icon name="right" size={18} /></a>
      </div>
      <p className="version"><Wordmark className="brand-word" /> v{APP_VERSION}</p>
    </section>
  )
}
