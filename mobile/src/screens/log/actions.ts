/* Löschen mit Rückfrage (natives Alert), gemeinsam für Feed-Kontextmenü, Tag im Verlauf und
   Cardio-Sheet. Einheiten werden nur als gelöscht markiert (t.removeSession → Sync). */
import * as L from '@lever/core/logic.ts'
import { t as tr, tn } from '@lever/core/i18n/index.ts'
import { platform } from '@lever/core/platform.ts'
import type { Activity, Session } from '@lever/domain/model.ts'
import type { Training } from '@lever/core/useTraining.ts'
import { ask } from '@/ui'

/** läuft diese Einheit gerade? */
export const isRunning = (t: Training, s: Session) =>
  !!t.active && L.sessionId(L.localDate(new Date(t.active.start)), t.active.workout) === s.id

export async function confirmRemoveSession(t: Training, s: Session): Promise<boolean> {
  const w = t.ix.workouts.get(s.workout)
  const what = tn('history.deleteSessionWhat', s.sets.length, { workout: w?.name ?? tr('history.sessionFallback'), date: L.fmtDate(s.date) })
  platform().signals.haptic('warning')
  const ok = await ask({
    title: tr('history.deleteSessionTitle'),
    message: `${what}${isRunning(t, s) ? tr('history.deleteSessionRunning') : ''}${tr('history.deleteSessionFinal')}`,
    ok: tr('history.delete'), destructive: true,
  })
  if (ok) t.removeSession(s.id)
  return ok
}

export async function confirmRemoveActivity(t: Training, a: Activity): Promise<boolean> {
  platform().signals.haptic('warning')
  const ok = await ask({
    title: tr('history.deleteActivityTitle', { name: L.activityTitle(a) }),
    message: tr('history.deleteActivityMessage', { date: L.fmtDate(a.date) }),
    ok: tr('history.delete'), destructive: true,
  })
  if (ok) t.removeActivity(a.id)
  return ok
}
