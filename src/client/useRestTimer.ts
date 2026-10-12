'use client'
/* Pausen-Timer: zeitstempelbasiert (übersteht App-Wechsel und Display-aus),
   am Ende Ton + Vibration + 6 s „ringing“ für das optische Signal. */
import { useCallback, useEffect, useState } from 'react'
import { alarm, primeAudio } from './signals'

export function useRestTimer() {
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [ringing, setRinging] = useState(false)
  const [total, setTotal] = useState(0)   // Länge des laufenden Countdowns – für den Ring

  useEffect(() => {
    if (!end) return
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= end) { setEnd(null); setRinging(true); alarm() }
    }
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [end])

  useEffect(() => {
    if (!ringing) return
    const id = setTimeout(() => setRinging(false), 6000)
    return () => clearTimeout(id)
  }, [ringing])

  const start = useCallback((sec: number) => { primeAudio(); setRinging(false); setNow(Date.now()); setTotal(sec); setEnd(Date.now() + sec * 1000) }, [])
  const stop = useCallback(() => { setEnd(null); setRinging(false) }, [])
  /** laufende Pause verlängern/verkürzen (±15 s, +30 s); nie unter 0 */
  const shift = useCallback((sec: number) => {
    setEnd(e => (e === null ? e : Math.max(Date.now(), e + sec * 1000)))
    setTotal(t => Math.max(1, t + sec))
  }, [])

  return { running: end !== null, remaining: end ? Math.max(0, Math.ceil((end - now) / 1000)) : 0, total, ringing, start, stop, shift }
}
export type RestTimer = ReturnType<typeof useRestTimer>
