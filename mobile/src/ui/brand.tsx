/* Lever-Marke und Wortmarke als Vektor (react-native-svg). Pfade aus art/brand/mark.py
   (src/client/brandPaths.ts) – Form nur dort ändern. */
import Svg, { G, Path } from 'react-native-svg'
import { MARK_FEET, MARK_STEM, MARK_VIEWBOX, WORD_LETTERS, WORD_MARK, WORD_VIEWBOX } from '@lever/client/brandPaths.ts'
import { color as C } from './theme'

const ratio = (vb: string) => { const [, , w, h] = vb.split(' ').map(Number); return w / h }

/** Wortmarke LEVER; height = Versalhöhe */
export function Wordmark({ height = 18, color = C.accent }: { height?: number; color?: string }) {
  return (
    <Svg width={height * ratio(WORD_VIEWBOX)} height={height} viewBox={WORD_VIEWBOX} accessibilityRole="image" accessibilityLabel="Lever">
      <G fill={color}>
        <Path d={WORD_MARK[0]} />
        <Path d={WORD_MARK[1]} />
        {WORD_LETTERS.map(([x, d]) => <Path key={x} transform={`translate(${x} 700) scale(1 -1)`} d={d} />)}
      </G>
    </Svg>
  )
}

/** Zeichen; level verkürzt den Fuß auf eine Progressionsstufe (0 Tuck … 3 Full) */
export function LeverMark({ height = 40, level = 3, color = C.accent }: { height?: number; level?: number; color?: string }) {
  return (
    <Svg width={height * ratio(MARK_VIEWBOX)} height={height} viewBox={MARK_VIEWBOX} accessibilityElementsHidden>
      <G fill={color}>
        <Path d={MARK_STEM} />
        <Path d={MARK_FEET[Math.max(0, Math.min(3, level))]} />
      </G>
    </Svg>
  )
}
