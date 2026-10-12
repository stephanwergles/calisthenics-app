/* Lever-Zeichen „Gelenk“: zwei Hebelarme (Arme, Körper), verbunden über eine Gehrungsfuge.
   Maße wie art/brand/mark.py (Modul M = Stammbreite = Fußhöhe, 7° geneigt) – Änderungen an beiden Stellen.
   Die viewBox umfasst immer das volle Zeichen, damit es beim Wachsen der Stufen nicht springt. */

const T = Math.tan((7 * Math.PI) / 180)
export const M = 24
const H = 4 * M
const FULL = 3 * M
const GAP = M / 6
/** Fußlänge je Stufe in M – Tuck → Advanced Tuck → Straddle → Full */
export const LEVELS = [1.45, 1.95, 2.5, 3] as const

type Pt = [number, number]
const skew = ([x, y]: Pt): Pt => [x + T * (H - y), y]
const pts = (p: Pt[]) => p.map(q => skew(q).map(n => n.toFixed(2)).join(',')).join(' ')
// Gehrung 45° von Innen- zu Außenecke; Fuge senkrecht = GAP, Schnitt trifft die Außenkanten genau
const d = GAP / Math.SQRT2

/** Stamm (Arme) bis zur Gehrung */
export const STEM = pts([[0, 0], [M, 0], [M, H - M - d], [0, H - d]])
/** Fuß (Körper) mit Länge in M */
export const foot = (len: number) => pts([[M + d, H - M], [len * M, H - M], [len * M, H], [d, H]])

const x0 = skew([0, H - d])[0]
const x1 = skew([FULL, H - M])[0]
export const VIEWBOX = `${x0.toFixed(2)} 0 ${(x1 - x0).toFixed(2)} ${H}`

/** Das Zeichen in currentColor; `level` verkürzt den Fuß auf eine Progressionsstufe */
export function LeverMark({ className, level = 3, title }: { className?: string; level?: number; title?: string }) {
  return (
    <svg className={className} viewBox={VIEWBOX} fill="currentColor" role={title ? 'img' : undefined}
      aria-label={title} aria-hidden={title ? undefined : true}>
      <polygon points={STEM} />
      <polygon points={foot(LEVELS[level])} />
    </svg>
  )
}
