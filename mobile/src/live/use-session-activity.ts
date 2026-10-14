/* Steuert die Live Activity (session-activity.tsx): startet mit der Session, aktualisiert bei
   Pause, Satz und Übungswechsel, endet mit dem Training. Nach einem Neustart der App wird eine
   noch laufende Activity übernommen (getInstances) statt doppelt gestartet. Nur iOS. */
import { useEffect, useRef } from 'react'
import type { LiveActivity } from 'expo-widgets'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Training } from '@lever/core/useTraining.ts'
import type { RestTimer } from '@lever/core/useRestTimer.ts'
import SessionActivity, { type SessionActivityProps } from './session-activity'

const ios = process.env.EXPO_OS === 'ios'

export function useSessionActivity(t: Training, rest: RestTimer, slots: L.SlotView[], focus: string | undefined) {
  const instance = useRef<LiveActivity<SessionActivityProps> | null>(null)
  const last = useRef('')

  const active = t.active
  const resting = rest.running && rest.end !== null
  const next = active ? L.upNext(slots, focus) : null
  const counted = slots.filter(s => s.state !== 'paused' && s.state !== 'skipped')
  const props: SessionActivityProps | null = active ? {
    start: active.start,
    ...(resting ? { restStart: rest.end! - rest.total * 1000, restEnd: rest.end! } : {}),
    label: (resting ? tr('training.rest.title') : tr('app.training')).toUpperCase(),
    title: t.ix.workouts.get(active.workout)?.name ?? tr('training.bar.fallback'),
    line: next ? `${tr('app.restNext', { set: next.setNo, total: next.slot.planned })} · ${next.slot.step.exercise.name}` : tr('training.liveDone'),
    done: counted.reduce((n, s) => n + Math.min(s.sets.length, s.planned), 0),
    total: counted.reduce((n, s) => n + s.planned, 0),
  } : null
  const key = props ? JSON.stringify(props) : ''

  useEffect(() => {
    if (!ios) return
    try {
      if (!props) {
        // Session beendet → Activity sofort entfernen (auch eine aus einem früheren App-Start)
        const all = [...(instance.current ? [instance.current] : []), ...SessionActivity.getInstances()]
        instance.current = null; last.current = ''
        for (const a of all) void a.end('immediate').catch(() => undefined)
        return
      }
      if (key === last.current) return
      last.current = key
      instance.current ??= SessionActivity.getInstances()[0] ?? null
      if (instance.current) void instance.current.update(props).catch(() => undefined)
      else instance.current = SessionActivity.start(props, 'lever://training')
    } catch { /* ohne Live Activity weiter (z. B. vom Nutzer abgeschaltet) */ }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
