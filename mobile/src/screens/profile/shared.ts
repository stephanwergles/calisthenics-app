/* Gemeinsames für Profil und Onboarding: Profil lesen/ändern, Zusammenfassungen der Zeilen,
   Sync-Status in einem Satz, App-Version. (Web: ProfileParts.tsx, DataView.tsx) */
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import * as L from '@lever/core/logic.ts'
import { catalogData } from '@lever/core/data.ts'
import type { Training } from '@lever/core/useTraining.ts'
import type { Profile } from '@lever/domain/model.ts'
import { intl, t as tr, tn, type Key } from '@lever/core/i18n/index.ts'
import { toast } from '@lever/core/toast.ts'

/** Version aus dem App-Paket (Fallback: app.config.ts) */
export const APP_VERSION = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–'

/** Onboarding: Weiter-Knopf in der Fußzeile, optional „Überspringen“ */
export interface Next { title: string; onNext: () => void; onSkip?: () => void }

/** Profil lesen und ändern (legt es beim ersten Ändern mit Standardwerten an) */
export function useProfile(t: Training) {
  const profile = L.profileOf(t.ix, t.state)
  const change = (fn: (p: Profile) => Profile) => t.setState(st => ({ ...st, profile: fn(L.profileOf(t.ix, st)) }))
  return { profile, change }
}

/** Text zu einem Schlüssel, der evtl. nicht existiert (Erklärungen je Skill/Gerät) */
export const blurb = (key: string) => { const s = tr(key as Key); return s === key ? undefined : s }

/** Zusammenfassungen für die Profil-Zeilen */
export function profileSummary(t: Training) {
  const p = L.profileOf(t.ix, t.state)
  const { skills, splits } = catalogData(t.ix.catalog)
  const names = p.goals.map(g => skills.find(s => s.id === g)?.name ?? g)
  const split = splits.find(x => x.id === p.split && x.themes.length === p.days.length)
  return {
    goals: names.length ? names.join(' · ') : tr('profile.goals.none'),
    equipment: p.equipment.map(e => L.EQUIPMENT_LABEL[e as keyof typeof L.EQUIPMENT_LABEL]).filter(Boolean).join(', ') || tr('profile.equipment.none'),
    days: tr('profile.days.summary', { days: L.WEEK_ORDER.filter(d => p.days.includes(d)).map(d => L.WEEKDAY_SHORT[d]).join(' · ') || tr('profile.days.none'), min: p.minutes })
      + (split ? ` · ${split.name}` : ''),
    assessment: p.assessment ? tr('profile.assessment.summaryDone', { date: L.fmtShortDate(p.assessment.date) }) : tr('profile.assessment.summaryNone'),
  }
}

export const fmtSync = (iso: string | null) => {
  if (!iso) return tr('profile.sync.never')
  const d = new Date(iso)
  const same = d.toDateString() === new Date().toDateString()
  return same ? tr('profile.sync.today', { time: d.toLocaleTimeString(intl(), { hour: '2-digit', minute: '2-digit' }) })
    : d.toLocaleString(intl(), { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Sync-Zustand in einem Satz */
export const syncStatus = (s: Training['sync']) => s.phase === 'syncing' ? tr('profile.sync.syncing')
  : s.phase === 'offline' ? tr('profile.sync.offline')
  : s.phase === 'error' ? tr('profile.sync.error', { msg: s.error ?? tr('profile.sync.unknown') })
  : s.pending ? tn('profile.sync.pending', s.pending)
  : tr('profile.sync.done')

/** Abgleich auf Knopfdruck – mit Rückmeldung als Toast (automatische Läufe bleiben still) */
export async function manualSync(t: Training) {
  const r = await t.syncNow()
  if (r === 'ok') toast(tr('common.toast.synced'), 'success')
  else if (r === 'error') toast(tr('common.toast.syncFailed'), 'error')
}
