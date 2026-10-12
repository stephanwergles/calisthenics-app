'use client'
/* Timer für Halteübungen (L-Sit, Hollow Hold, Handstand …): erst ein kurzer Countdown zum
   Positionieren, dann der eigentliche Halte-Countdown. Zeitstempelbasiert wie der Pausen-Timer. */
import { useCallback, useEffect, useState } from 'react'
import { alarm, primeAudio } from './signals'
import { buzz, tap } from './native'

export const PREP_SEC = 5

export type HoldPhase = 'idle' | 'prep' | 'hold' | 'done'

export function useHoldTimer() {
  const [phase, setPhase] = useState<HoldPhase>('idle')
  const [end, setEnd] = useState(0)
  const [total, setTotal] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (phase !== 'prep' && phase !== 'hold') return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t < end) return
      if (phase === 'prep') { tap(); setPhase('hold'); setEnd(t + total * 1000) }
      else { alarm(); buzz(); setPhase('done') }
    }
    const id = setInterval(tick, 100)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [phase, end, total])

  const start = useCallback((sec: number) => {
    primeAudio(); tap()
    const t = Date.now()
    setTotal(sec); setNow(t); setEnd(t + PREP_SEC * 1000); setPhase('prep')
  }, [])
  const cancel = useCallback(() => setPhase('idle'), [])

  const leftMs = phase === 'prep' || phase === 'hold' ? Math.max(0, end - now) : 0
  const span = phase === 'prep' ? PREP_SEC * 1000 : total * 1000
  return {
    phase, total, start, cancel,
    /** ganze Sekunden für die Anzeige */
    left: Math.ceil(leftMs / 1000),
    /** Anteil 0–1 für den Ring (läuft flüssig, nicht in Sekundenschritten) */
    share: span ? leftMs / span : 0,
  }
}
export type HoldTimer = ReturnType<typeof useHoldTimer>
