'use client'
/* Startanimation: übernimmt nahtlos das native Startbild (Zeichen in der Tuck-Stufe, 11 % der
   Bildschirmhöhe, mittig – art/blender/brand.py) und verlängert den Hebel in Stufen bis Full.
   Sichtbar nur in der iOS-App und als Home-Bildschirm-App (CSS); im Browser-Tab bleibt sie aus.
   Steht schon im vorgerenderten HTML, damit zwischen Startbild und App kein leerer Frame liegt. */
import { useEffect, useState } from 'react'
import { MARK_FEET, MARK_STEM, MARK_VIEWBOX } from '../brandPaths'

const STEPS_MS = 560   // bis Full steht (CSS: .splash .lv)
const OUT_MS = 280     // Ausblenden

export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [shown, setShown] = useState(false)
  const [phase, setPhase] = useState<'run' | 'out' | 'gone'>('run')

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setShown(true), reduce ? 0 : STEPS_MS)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!ready || !shown || phase !== 'run') return
    setPhase('out')
    const t = setTimeout(() => { setPhase('gone'); onDone() }, OUT_MS)
    return () => clearTimeout(t)
  }, [ready, shown]) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'gone') return null
  return (
    <div className={`splash${phase === 'out' ? ' out' : ''}`} aria-hidden="true">
      <svg viewBox={MARK_VIEWBOX} fill="currentColor">
        <path d={MARK_STEM} />
        {MARK_FEET.map((d, i) => <path key={i} className={i ? `lv lv${i}` : undefined} d={d} />)}
      </svg>
    </div>
  )
}
