/* Live Activity während einer Challenge (Sperrbildschirm, Dynamic Island): nutzt dasselbe Widget
   wie das Training (session-activity.tsx) als eigene Instanz. Countdown bei AMRAP (läuft als
   SwiftUI-Timer auch bei gesperrtem Gerät), sonst Stoppuhr; die Zeile zeigt den Zähler. Endet mit
   dem Ergebnis oder beim Verlassen. Nur iOS. */
import { useEffect, useRef } from 'react'
import type { LiveActivity } from 'expo-widgets'
import * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import type { Challenge } from '@lever/domain/model.ts'
import SessionActivity, { type SessionActivityProps } from './session-activity'

const ios = process.env.EXPO_OS === 'ios'

/** start = Beginn des Versuchs (ms) oder null (Vorlauf/Ergebnis → keine Activity) */
export function useChallengeActivity(c: Challenge, start: number | null, count: number, line?: string) {
  const instance = useRef<LiveActivity<SessionActivityProps> | null>(null)
  const props: SessionActivityProps | null = start ? {
    start,
    ...(c.kind === 'amrap' ? { restStart: start, restEnd: start + (c.seconds ?? 60) * 1000 } : {}),
    label: tr('challenge.title').toUpperCase(),
    title: c.name,
    line: line ?? (L.challengeMeasuresTime(c) && c.kind === 'max' ? L.fmtChallengeRule(c)
      : c.kind === 'fortime' ? `${count} / ${c.target ?? 0}` : L.fmtChallengeValue(c, count)),
    done: c.kind === 'fortime' ? count : 0,
    total: c.kind === 'fortime' ? c.target ?? 0 : 0,
  } : null
  const key = props ? JSON.stringify(props) : ''

  useEffect(() => {
    if (!ios) return
    try {
      if (!props) { void instance.current?.end('immediate').catch(() => undefined); instance.current = null; return }
      if (instance.current) void instance.current.update(props).catch(() => undefined)
      // ohne Link: Antippen holt nur die App nach vorn – die laufende Challenge liegt schon oben
      // (ein Link würde die Challenge-Liste darüberlegen)
      else instance.current = SessionActivity.start(props)
    } catch { /* ohne Live Activity weiter */ }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Verlassen der Challenge (Schließen, Abbruch): Activity entfernen
  useEffect(() => () => { void instance.current?.end('immediate').catch(() => undefined); instance.current = null }, [])
}
