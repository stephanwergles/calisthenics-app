'use client'
import { useState } from 'react'
import type { Training } from '../useTraining'
import { APP_VERSION } from '../version'
import { Icon } from './Icon'
import { ask } from '../native'
import { HEALTH_CONSENT, PRIVACY_URL } from '../consent'
import { Wordmark } from './LeverMark'

const fmtSync = (iso: string | null) => {
  if (!iso) return 'noch nie'
  const d = new Date(iso)
  const same = d.toDateString() === new Date().toDateString()
  return same ? `heute ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Account({ t }: { t: Training }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  const s = t.sync

  if (s.account) {
    const status = s.phase === 'syncing' ? 'Gleiche ab …'
      : s.phase === 'offline' ? 'Offline – wird nachgeholt, sobald Netz da ist.'
      : s.phase === 'error' ? `Fehler beim Abgleich: ${s.error ?? 'unbekannt'}`
      : s.pending ? `${s.pending} Änderung${s.pending === 1 ? '' : 'en'} warten auf Abgleich.`
      : 'Alles abgeglichen.'
    return (
      <div className="card">
        <h2>Sync</h2>
        <p className="meta">Angemeldet als <b>{s.account.email}</b></p>
        <p className={s.phase === 'error' ? 'warn' : 'hint'}>{status} Letzter Abgleich: {fmtSync(s.lastSync)}.</p>
        {s.phase !== 'error' && s.error && <p className="warn">Vom Server abgelehnt: {s.error}</p>}
        {s.consentMissing && (
          <div className="consent-missing">
            <p className="warn">Abgleich pausiert: Für die Speicherung auf dem Server fehlt deine Einwilligung in die Gesundheitsdaten.</p>
            <button className="btn btn-primary btn-block" onClick={() => void t.acceptHealthConsent().catch(e => alert((e as Error).message))}>{HEALTH_CONSENT.ok}</button>
          </div>
        )}
        <div className="row-btns">
          <button className="btn btn-secondary grow" disabled={s.phase === 'syncing'} onClick={() => void t.syncNow()}>Jetzt abgleichen</button>
          <button className="btn btn-ghost" onClick={async () => { if (await ask({ title: 'Abmelden?', message: 'Die Daten bleiben auf diesem Gerät, werden aber nicht mehr abgeglichen.', ok: 'Abmelden' })) void t.signOut() }}>Abmelden</button>
        </div>
        <button className="btn btn-danger btn-block account-delete" onClick={async () => {
          if (!await ask({ title: 'Konto löschen?', message: `Das Konto ${s.account!.email} und alle Trainingsdaten auf dem Server werden endgültig gelöscht. Auf diesem Gerät bleiben deine Daten erhalten – sichere sie vorher per Export, wenn du sie behalten willst.`, ok: 'Konto löschen', destructive: true })) return
          try { await t.deleteAccount() } catch (e) { alert(`Löschen fehlgeschlagen: ${(e as Error).message}`) }
        }}><Icon name="trash" size={18} /> Konto löschen</button>
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
      <h2>Sync</h2>
      <p className="hint">
        {s.account === undefined && s.phase === 'offline' ? 'Offline – Anmeldung prüfen, sobald Netz da ist. ' : ''}
        Anmelden, damit Training und Einstellungen auf dem Server gesichert und zwischen Geräten abgeglichen werden. Beim ersten Abgleich wird alles von diesem Gerät hochgeladen.
      </p>
      <label className="field">E-Mail
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="field">Passwort
        <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      </label>
      <label className="consent-check">
        <input type="checkbox" required checked={agree} onChange={e => setAgree(e.target.checked)} />
        <span>{HEALTH_CONSENT.short} <a href={PRIVACY_URL} target="_blank" rel="noopener">Datenschutzerklärung</a></span>
      </label>
      {err && <p className="warn">{err}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || !agree}>{busy ? 'Melde an …' : 'Anmelden'}</button>
    </form>
  )
}

export function DataView({ t }: { t: Training }) {
  const [msg, setMsg] = useState<string[] | null>(null)
  const sets = t.sessions.reduce((n, s) => n + s.sets.length, 0)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const v1 = JSON.parse(await file.text())
      if (!v1 || typeof v1.log !== 'object') throw new Error('Kein v1-Export')
      if (!await ask({ title: 'v1-Export übernehmen?', message: 'Einheiten mit gleichem Datum und Workout werden ersetzt, alle anderen bleiben. Der Trainingsstand wird aus dem Export übernommen.', ok: 'Übernehmen' })) return
      const r = await t.importV1(v1)
      setMsg([
        `Übernommen: ${r.sessions} Einheiten, ${r.sets} Sätze, ${r.activities} Aktivitäten.`,
        ...(r.dropped.length ? [`${r.dropped.length} leere Tage verworfen.`] : []),
        ...r.warnings.map(w => `Hinweis: ${w}`),
      ])
    } catch (e) {
      setMsg([`Import fehlgeschlagen: ${(e as Error).message}`])
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
      <span className="h-date">{!t.sync.account ? 'Nur auf diesem Gerät' : t.sync.phase === 'error' ? 'Sync-Fehler' : t.sync.pending ? 'Änderungen warten auf Abgleich' : 'Abgeglichen'}</span>
      <h2 className="page-title display">Daten</h2>
      <div className="card hv-month">
        <div className="hv-stats" aria-label="Auf diesem Gerät">
          <div><span className="num">{t.sessions.length}</span><small>Einheiten</small></div>
          <div><span className="num">{sets}</span><small>Sätze</small></div>
          <div><span className="num">{t.activities.length}</span><small>Cardio</small></div>
        </div>
        {!t.persistent && <p className="warn">Dieser Browser erlaubt keinen dauerhaften Speicher – Daten gehen beim Schließen verloren.</p>}
      </div>
      <Account t={t} />
      <div className="card">
        <h2>Aus v1 übernehmen</h2>
        <p className="hint">Den JSON-Export aus der bisherigen App wählen. Wiederholbar – gleiche Einheiten werden ersetzt, nicht verdoppelt.</p>
        <label className="btn btn-secondary btn-block">
          v1-Export wählen
          <input type="file" accept="application/json,.json" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {msg && <ul className="result">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </div>
      <div className="card">
        <h2>Sichern</h2>
        <button className="btn btn-secondary btn-block" onClick={download}>Export (JSON)</button>
        <a className="btn btn-ghost btn-block" href="/admin">Katalog verwalten <Icon name="right" size={18} /></a>
      </div>
      <p className="version"><Wordmark className="brand-word" /> v{APP_VERSION}</p>
    </section>
  )
}
