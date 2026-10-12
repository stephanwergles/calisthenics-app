'use client'
import { useEffect, useState } from 'react'

/** aktuelle Zeit, sekündlich aktualisiert – nur solange `enabled` */
export function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
  return now
}
