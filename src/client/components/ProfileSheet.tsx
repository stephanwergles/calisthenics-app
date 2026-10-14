'use client'
/* Profil: Konto, Sync, Einwilligung, Daten – erreichbar über den Avatar rechts oben auf jeder
   Hauptseite (ersetzt den früheren Tab „Daten“). In der iOS-App als natives Sheet. */
import { useRef, useState } from 'react'
import type { Training } from '@/core/useTraining'
import { APP_VERSION } from '../version'
import { ask, nativeFiles, type NBlock } from '../native'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { HEALTH_CONSENT, PRIVACY_URL } from '@/core/consent'
import { DataView, manualSync, syncStatus } from './DataView'
import { toast } from '@/core/toast'
import { Sheet } from './Sheets'
import { AssessmentPage, FeedbackPage, DaysSheet, EquipmentSheet, GoalPicker, LanguagePage, profileSummary, type LocaleChoice } from './ProfileParts'
import { Icon } from './Icon'
import { t as tr } from '@/core/i18n'

type Part = 'goals' | 'equipment' | 'days' | 'assessment' | 'feedback' | 'language' | null

export function ProfileSheet({ t, onClose, localeChoice, changeLocale }: {
  t: Training; onClose: () => void; localeChoice: LocaleChoice; changeLocale: (l: LocaleChoice) => void
}) {
  const native = useNativeShell()
  const s = t.sync
  const sets = t.sessions.reduce((n, x) => n + x.sets.length, 0)
  const form = useRef({ email: '', password: '' })
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [part, setPart] = useState<Part>(null)
  const [dataMsg, setDataMsg] = useState<{ text: string; warn?: boolean } | null>(null)
  const exportJson = async () => {
    const ok = await nativeFiles.share(`calisthenics-v2-${t.today}.json`, JSON.stringify(t.exportData(), null, 2))
    if (ok) toast(tr('common.toast.exported'), 'success')
  }
  const importV1 = async () => {
    const text = await nativeFiles.pick()
    if (!text) return
    try {
      const v1 = JSON.parse(text)
      if (!v1 || typeof v1.log !== 'object') throw new Error(tr('profile.v1.notV1'))
      if (!await ask({ title: tr('profile.v1.askTitle'), message: tr('profile.v1.askMessage'), ok: tr('common.apply') })) return
      const r = await t.importV1(v1)
      toast(tr('common.toast.imported'), 'success')
      setDataMsg({ text: tr('profile.v1.imported', { sessions: r.sessions, sets: r.sets, activities: r.activities }) + (r.warnings.length ? tr('profile.v1.hints', { n: r.warnings.length }) : '') })
    } catch (e) { setDataMsg({ text: tr('profile.v1.failed', { msg: (e as Error).message }), warn: true }) }
  }
  const sum = profileSummary(t)
  const training = [
    { id: 'goals' as const, title: tr('profile.row.goals'), sub: sum.goals, symbol: 'target' },
    { id: 'equipment' as const, title: tr('profile.row.equipment'), sub: sum.equipment, symbol: 'dumbbell' },
    { id: 'days' as const, title: tr('profile.row.days'), sub: sum.days, symbol: 'calendar' },
    { id: 'assessment' as const, title: tr('profile.row.assessment'), sub: sum.assessment, symbol: 'gauge.with.dots.needle.33percent' },
  ]
  const app = [{ id: 'language' as const, title: tr('profile.row.language'), sub: tr(`profile.language.${localeChoice}`), symbol: 'globe' }]
  const syncing = s.phase === 'syncing'
  /* gruppierte Liste wie die iOS-Einstellungen: ein Block je Abschnitt */
  const list = (rows: { id: string; title: string; sub?: string; symbol: string }[]): NBlock =>
    ({ type: 'list', rows: rows.map(x => ({ id: `p:${x.id}`, title: x.title, subtitle: x.sub, symbol: x.symbol })) })
  const self = { id: 'profile', title: tr('profile.title') }
  const parts = <>
    {part === 'goals' && <GoalPicker t={t} parent={self} onClose={() => setPart(null)} />}
    {part === 'equipment' && <EquipmentSheet t={t} parent={self} onClose={() => setPart(null)} />}
    {part === 'feedback' && <FeedbackPage t={t} parent={self} onClose={() => setPart(null)} />}
    {part === 'assessment' && <AssessmentPage t={t} parent={self} onClose={() => setPart(null)} />}
    {part === 'days' && <DaysSheet t={t} parent={self} onClose={() => setPart(null)} />}
    {part === 'language' && <LanguagePage choice={localeChoice} onChange={changeLocale} parent={self} onClose={() => setPart(null)} />}
  </>

  const signIn = async () => {
    setBusy(true); setErr(null)
    try { await t.signIn(form.current.email.trim(), form.current.password, agree); form.current.password = '' }
    catch (x) { setErr((x as Error).message) }
    finally { setBusy(false) }
  }
  const deleteAccount = async () => {
    if (!await ask({ title: tr('profile.deleteAsk.title'), message: tr('profile.deleteAsk.message', { email: s.account!.email }), ok: tr('profile.deleteAccount'), destructive: true })) return
    try { await t.deleteAccount() } catch (e) { setErr(tr('profile.deleteFailed', { msg: (e as Error).message })) }
  }

  const sub = s.account ? `${s.account.email} · ${syncStatus(s)}` : tr('profile.localOnly')
  useNativeSheet(native ? {
    id: 'profile', title: tr('profile.title'), subtitle: sub, detents: ['large'],
    blocks: [
      { type: 'stats', items: [{ value: String(t.sessions.length), label: tr('profile.stats.sessions') }, { value: String(sets), label: tr('profile.stats.sets') }, { value: String(t.activities.length), label: tr('profile.stats.cardio') }] },
      { type: 'section', title: tr('profile.section.training') },
      list(training),
      { type: 'section', title: tr('profile.section.app') },
      list(app),
      { type: 'section', title: tr('profile.section.account') },
      ...(s.account ? [
        ...(s.consentMissing ? [
          { type: 'text', text: tr('profile.consentPaused'), style: 'warn' } as NBlock,
          { type: 'button', id: 'consent', title: HEALTH_CONSENT.ok, style: 'prominent' } as NBlock,
        ] : []),
        { type: 'buttons', buttons: [{ id: 'sync', title: syncing ? tr('profile.sync.syncing') : tr('profile.syncNow'), symbol: 'arrow.triangle.2.circlepath', busy: syncing }, { id: 'signout', title: tr('profile.signOut'), symbol: 'rectangle.portrait.and.arrow.right' }] } as NBlock,
      ] : [
        { type: 'text', text: tr('profile.signInHint'), style: 'muted' } as NBlock,
        { type: 'field', id: 'email', label: tr('profile.email'), value: '', keyboard: 'email' } as NBlock,
        { type: 'field', id: 'password', label: tr('profile.password'), value: '', keyboard: 'password' } as NBlock,
        { type: 'check', id: 'agree', style: 'select', title: HEALTH_CONSENT.short, on: agree } as NBlock,
        { type: 'button', id: 'signin', title: busy ? tr('profile.signingIn') : tr('profile.signIn'), style: 'prominent', busy } as NBlock,
      ]),
      ...(err ? [{ type: 'text', text: err, style: 'warn' } as NBlock] : []),
      { type: 'section', title: tr('profile.section.data') },
      { type: 'list', rows: [{ id: 'export', title: tr('profile.export'), symbol: 'square.and.arrow.up' }, { id: 'import', title: tr('profile.importV1'), symbol: 'square.and.arrow.down' }] },
      ...(dataMsg ? [{ type: 'text', text: dataMsg.text, style: dataMsg.warn ? 'warn' : 'small' } as NBlock] : []),
      { type: 'section', title: tr('profile.section.help') },
      list([{ id: 'feedback', title: tr('profile.feedbackRow.title'), sub: tr('profile.feedbackRow.sub'), symbol: 'bubble.left.and.text.bubble.right' }]),
      { type: 'section', title: tr('profile.section.legal') },
      { type: 'list', rows: [{ id: 'privacy', title: tr('common.privacy'), symbol: 'hand.raised' }] },
      ...(s.account ? [{ type: 'button', id: 'delete', title: tr('profile.deleteAccount'), symbol: 'trash', style: 'destructive' } as NBlock] : []),
      { type: 'brand', text: tr('profile.footer', { v: APP_VERSION }) },
    ],
  } : null, e => {
    if (e.type === 'text' && (e.id === 'email' || e.id === 'password')) form.current[e.id] = String(e.value ?? '')
    else if (e.type === 'toggle' && e.id === 'agree') setAgree(!!e.value)
    else if (e.type === 'tap' && e.id === 'signin' && !busy) {
      if (!agree) setErr(tr('profile.agreeFirst'))
      else void signIn()
    }
    else if (e.type === 'tap' && e.id === 'sync' && !syncing) void manualSync(t)
    else if (e.type === 'tap' && e.id === 'signout') void ask({ title: tr('profile.signOutAsk.title'), message: tr('profile.signOutAsk.message'), ok: tr('profile.signOut') }).then(ok => { if (ok) void t.signOut() })
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
      <Sheet large title={tr('profile.title')} sub={sub} onClose={onClose}>
        {([[tr('profile.section.training'), training], [tr('profile.section.app'), app]] as const).map(([title, rows]) => (
          <div key={title} className="card pf-training">
            <h2>{title}</h2>
            <ul>
              {rows.map(x => (
                <li key={x.id}>
                  <button className="pf-row" onClick={() => setPart(x.id)}>
                    <span><b>{x.title}</b><small>{x.sub}</small></span>
                    <Icon name="right" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button className="card pf-row pf-feedback" onClick={() => setPart('feedback')}>
          <span><b>{tr('profile.feedbackRow.title')}</b><small>{tr('profile.feedbackRow.sub')}</small></span>
          <Icon name="right" size={16} />
        </button>
        <DataView t={t} embedded />
      </Sheet>
      {parts}
    </>
  )
}
