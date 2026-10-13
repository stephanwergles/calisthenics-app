/* Lever-Marke: Zeichen „Gelenk“ (zwei Hebelarme, verbunden über eine Gehrungsfuge) und die
   Wortmarke, in der das Zeichen das L ist. Pfade kommen aus art/brand/mark.py (brandPaths.ts) –
   Form nur dort ändern. Beide in currentColor. */
import { MARK_FEET, MARK_STEM, MARK_VIEWBOX, WORD_LETTERS, WORD_MARK, WORD_VIEWBOX } from '../brandPaths'

/** Das Zeichen; `level` verkürzt den Fuß auf eine Progressionsstufe (0 Tuck … 3 Full) */
export function LeverMark({ className, level = 3, title }: { className?: string; level?: number; title?: string }) {
  return (
    <svg className={className} viewBox={MARK_VIEWBOX} fill="currentColor" role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={MARK_STEM} />
      <path d={MARK_FEET[level]} />
    </svg>
  )
}

/** Wortmarke LEVER – Höhe = Versalhöhe, per CSS über `height` setzen */
export function Wordmark({ className, title = 'Lever' }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox={WORD_VIEWBOX} fill="currentColor" role="img" aria-label={title}>
      <path d={WORD_MARK[0]} />
      <path d={WORD_MARK[1]} />
      {WORD_LETTERS.map(([x, d]) => <path key={x} transform={`translate(${x} 700) scale(1 -1)`} d={d} />)}
    </svg>
  )
}
