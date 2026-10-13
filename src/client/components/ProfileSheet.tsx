'use client'
/* Profil: Konto, Sync, Einwilligung, Daten – erreichbar über den Avatar rechts oben auf jeder
   Hauptseite (ersetzt den früheren Tab „Daten“). In der iOS-App als natives Sheet. */
import { useRef, useState } from 'react'
import type { Training } from '../useTraining'
import { APP_VERSION } from '../version'
import { ask, nativeFiles, type NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { HEALTH_CONSENT, PRIVACY_URL } from '../consent'
import { DataView, syncStatus } from './DataView'
import { Sheet } from './Sheets'
import { AssessmentPage, DaysSheet, EquipmentSheet, GoalPicker, profileSummary } from './ProfileParts'
import { Icon } from './Icon'

type Part = 'goals' | 'equipment' | 'days' | 'assessment' | null

export function ProfileSheet({ t, onClose }: { t: Training; onClose: () => void }) {
  const native = useNativeShell()
  const s = t.sync
  const sets = t.sessions.reduce((n, x) => n + x.sets.length, 0)
  const form = useRef({ email: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [part, setPart] = useState<Part>(null)
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const exportJson = async () => {
    const ok = await nativeFiles.share(`calisthenics-v2-${t.today}.json`, JSON.stringify(t.exportData(), null, 2))
    if (ok) setDataMsg('Export gesichert.')
  }
  const importV1 = async () => {
    const text = await nativeFiles.pick()
    if (!text) return
    try {
      const v1 = JSON.parse(text)
      if (!v1 || typeof v1.log !== 'object') throw new Error('Kein v1-Export')
      if (!await ask({ title: 'v1-Export übernehmen?', message: 'Einheiten mit gleichem Datum und Workout werden ersetzt, alle anderen bleiben. Der Trainingsstand wird aus dem Export übernommen.', ok: 'Übernehmen' })) return
      const r = await t.importV1(v1)
      setDataMsg(`Übernommen: ${r.sessions} Einheiten, ${r.sets} Sätze, ${r.activities} Aktivitäten.${r.warnings.length ? ` ${r.warnings.length} Hinweise.` : ''}`)
    } catch (e) { setDataMsg(`Import fehlgeschlagen: ${(e as Error).message}`) }
  }
  const sum = profileSummary(t)
  const training = [
    { id: 'goals' as const, title: 'Ziele', sub: sum.goals },
    { id: 'equipment' as const, title: 'Ausrüstung', sub: sum.equipment },
    { id: 'days' as const, title: 'Trainingstage & Dauer', sub: sum.days },
    { id: 'assessment' as const, title: 'Einstufung', sub: sum.assessment },
  ]
  const parts = <>
    {part === 'goals' && <GoalPicker t={t} parent={{ id: 'profile', title: 'Profil' }} onClose={() => setPart(null)} />}
    {part === 'equipment' && <EquipmentSheet t={t} parent={{ id: 'profile', title: 'Profil' }} onClose={() => setPart(null)} />}
    {part === 'assessment' && <AssessmentPage t={t} parent={{ id: 'profile', title: 'Profil' }} onClose={() => setPart(null)} />}
    {part === 'days' && <DaysSheet t={t} parent={{ id: 'profile', title: 'Profil' }} onClose={() => setPart(null)} />}
  </>

  const signIn = async () => {
    setBusy(true); setErr(null)
    try { await t.signIn(form.current.email.trim(), form.current.password, agree); form.current.password = '' }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  const deleteAccount = async () => {
    if (!await ask({ title: 'Konto löschen?', message: `Das Konto ${s.account!.email} und alle Trainingsdaten auf dem Server werden endgültig gelöscht. Auf diesem Gerät bleiben deine Daten erhalten – sichere sie vorher per Export, wenn du sie behalten willst.`, ok: 'Konto löschen', destructive: true })) return
    try { await t.deleteAccount() } catch (e) { setErr(`Löschen fehlgeschlagen: ${(e as Error).message}`) }
  }

  const sub = s.account ? `${s.account.email} · ${syncStatus(s)}` : 'Nur auf diesem Gerät'
  useNativeSheet(native ? {
    id: 'profile', title: 'Profil', subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stats', items: [{ value: String(t.sessions.length), label: 'Einheiten' }, { value: String(sets), label: 'Sätze' }, { value: String(t.activities.length), label: 'Cardio' }] },
      { type: 'section', title: 'Training' },
      ...training.map((x): NBlock => ({ type: 'row', id: `p:${x.id}`, title: x.title, subtitle: x.sub, symbol: 'none' })),
      { type: 'section', title: 'Konto & Sync' },
      ...(s.account ? [
        ...(s.consentMissing ? [
          { type: 'text', text: 'Abgleich pausiert: Für die Speicherung auf dem Server fehlt deine Einwilligung in die Gesundheitsdaten.', style: 'warn' } as NBlock,
          { type: 'button', id: 'consent', title: HEALTH_CONSENT.ok, style: 'prominent' } as NBlock,
        ] : []),
        { type: 'buttons', buttons: [{ id: 'sync', title: 'Jetzt abgleichen', symbol: 'arrow.triangle.2.circlepath' }, { id: 'signout', title: 'Abmelden', symbol: 'rectangle.portrait.and.arrow.right' }] } as NBlock,
      ] : [
        { type: 'text', text: 'Anmelden, damit Training und Einstellungen auf dem Server gesichert und zwischen Geräten abgeglichen werden.', style: 'muted' } as NBlock,
        { type: 'field', id: 'email', label: 'E-Mail', value: '', keyboard: 'email' } as NBlock,
        { type: 'field', id: 'password', label: 'Passwort', value: '', keyboard: 'password' } as NBlock,
        { type: 'check', id: 'agree', style: 'select', title: HEALTH_CONSENT.short, on: agree } as NBlock,
        { type: 'button', id: 'signin', title: busy ? 'Melde an …' : 'Anmelden', style: 'prominent' } as NBlock,
      ]),
      ...(err ? [{ type: 'text', text: err, style: 'warn' } as NBlock] : []),
      { type: 'section', title: 'Daten' },
      { type: 'buttons', buttons: [{ id: 'export', title: 'Export (JSON)', symbol: 'square.and.arrow.up' }, { id: 'import', title: 'v1-Import', symbol: 'square.and.arrow.down' }] },
      ...(dataMsg ? [{ type: 'text', text: dataMsg, style: dataMsg.startsWith('Import fehlgeschlagen') ? 'warn' : 'small' } as NBlock] : []),
      { type: 'section', title: 'Rechtliches' },
      { type: 'button', id: 'privacy', title: 'Datenschutzerklärung', symbol: 'doc.text' },
      ...(s.account ? [{ type: 'button', id: 'delete', title: 'Konto löschen', symbol: 'trash', style: 'destructive' } as NBlock] : []),
      { type: 'text', text: `Lever v${APP_VERSION}`, style: 'small' },
    ],
  } : null, e => {
    if (e.type === 'text' && (e.id === 'email' || e.id === 'password')) form.current[e.id] = String(e.value ?? '')
    else if (e.type === 'toggle' && e.id === 'agree') setAgree(!!e.value)
    else if (e.type === 'tap' && e.id === 'signin' && !busy) {
      if (!agree) setErr('Bitte zuerst in die Verarbeitung der Gesundheitsdaten einwilligen.')
      else void signIn()
    }
    else if (e.type === 'tap' && e.id === 'sync') void t.syncNow()
    else if (e.type === 'tap' && e.id === 'signout') void ask({ title: 'Abmelden?', message: 'Die Daten bleiben auf diesem Gerät, werden aber nicht mehr abgeglichen.', ok: 'Abmelden' }).then(ok => { if (ok) void t.signOut() })
    else if (e.type === 'tap' && e.id === 'consent') void t.acceptHealthConsent().catch(x => setErr((x as Error).message))
    else if (e.type === 'tap' && e.id === 'privacy') window.open(PRIVACY_URL, '_blank')
    else if (e.type === 'tap' && e.id === 'delete') void deleteAccount()
    else if (e.type === 'tap' && e.id === 'export') void exportJson()
    else if (e.type === 'tap' && e.id === 'import') void importV1()
    else if (e.type === 'tap' && e.id?.startsWith('p:')) setPart(e.id.slice(2) as Part)
    else if (e.type === 'dismiss') onClose()
  })
  if (native) return parts
  return (
    <>
      <Sheet large title="Profil" sub={sub} onClose={onClose}>
        <div className="card pf-training">
          <h2>Training</h2>
          <ul>
            {training.map(x => (
              <li key={x.id}>
                <button className="pf-row" onClick={() => setPart(x.id)}>
                  <span><b>{x.title}</b><small>{x.sub}</small></span>
                  <Icon name="right" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <DataView t={t} embedded />
      </Sheet>
      {parts}
    </>
  )
}
