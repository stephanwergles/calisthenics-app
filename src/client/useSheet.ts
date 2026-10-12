'use client'
/* Bewegung für Sheets: Ein-/Ausblenden mit Animation und Ziehen am Griff (wie iOS). */
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

/** Gemountet bleiben, bis die Ausblend-Animation durch ist; `shown` schaltet die CSS-Klasse */
export function usePresence(open: boolean, ms = 380) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      // erst im nächsten Frame einblenden, sonst startet die Transition nicht
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const id = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(id)
  }, [open, ms])
  return { mounted, shown }
}

/** Ziehen am Griff: folgt dem Finger, löst beim Loslassen je nach Weg und Richtung aus.
    Antippen ohne Bewegung bleibt ein normaler Klick (kein Pointer-Capture). */
export function useDrag({ onDown, onUp, threshold = 90, up = false }: {
  onDown?: () => void; onUp?: () => void; threshold?: number; up?: boolean
}) {
  const [dy, setDy] = useState(0)
  const start = useRef<number | null>(null)
  const moved = useRef(false)
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    start.current = e.clientY; moved.current = false
    const move = (ev: PointerEvent) => {
      if (start.current === null) return
      const d = ev.clientY - start.current
      if (Math.abs(d) > 6) moved.current = true
      // nach unten frei, nach oben nur, wenn es dort etwas zu öffnen gibt – mit Widerstand
      setDy(d > 0 ? d : up ? d / 3 : 0)
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
      if (start.current === null) return
      const d = ev.clientY - start.current
      start.current = null; setDy(0)
      if (d > threshold) onDown?.()
      else if (up && d < -threshold / 2) onUp?.()
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
  }
  // ein Klick direkt nach einem Zug soll nichts auslösen
  const onClickCapture = (e: ReactMouseEvent) => { if (moved.current) { e.stopPropagation(); e.preventDefault(); moved.current = false } }
  const style: CSSProperties | undefined = dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined
  return { bind: { onPointerDown, onClickCapture }, style, dragging: dy !== 0 }
}
