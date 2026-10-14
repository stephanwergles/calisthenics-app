/* Mini-Balkendiagramm der letzten 12 Einheiten (Web: Spark in HistoryView): grau, jüngste in Volt,
   Stufenwechsel als senkrechte Linie, rechtsbündig (die jüngste Einheit steht immer rechts außen).
   #6a6a6a hält 3:1 auf der Karte und ist vom Akzent getrennt. Für VoiceOver ein Bild mit allen
   Werten als Text – die Wertetabelle der Kachel ist die ausführliche Alternative. */
import { View } from 'react-native'
import Svg, { Line, Path } from 'react-native-svg'
import type * as L from '@lever/core/logic.ts'
import { t as tr } from '@lever/core/i18n/index.ts'
import { color, Text } from '@/ui'

const BAR = '#6a6a6a'

export function Spark({ points }: { points: L.HistoryPoint[] }) {
  const pts = points.slice(-12), slot = 12, bw = 8, H = 40, W = 12 * slot
  const max = Math.max(1, ...pts.map(p => p.sum))
  const off = (12 - pts.length) * slot
  return (
    <View accessible accessibilityRole="image" style={{ width: W, height: H }}
      accessibilityLabel={tr('history.sparkLabel', { n: pts.length, values: pts.map(p => p.sum).join(', ') })}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {pts.map((p, i) => {
          const x = off + i * slot + 2, bh = Math.max(3, Math.round((p.sum / max) * (H - 2))), y = H - bh, r = Math.min(4, bh)
          const stepChange = i > 0 && p.step !== pts[i - 1].step
          return [
            stepChange ? <Line key={`l${i}`} x1={x - 2} x2={x - 2} y1={0} y2={H} stroke={color.muted} strokeWidth={1} /> : null,
            <Path key={`b${i}`} fill={i === pts.length - 1 ? color.accent : BAR}
              d={`M${x},${H}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + bw - r}A${r},${r} 0 0 1 ${x + bw},${y + r}V${H}Z`} />,
          ]
        })}
      </Svg>
    </View>
  )
}

/** Legende zum Diagramm: Balken, letzte Einheit, Stufenwechsel */
export function SparkKey() {
  const item = (swatch: React.ReactNode, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{swatch}<KeyText>{text}</KeyText></View>
  )
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, paddingHorizontal: 2 }}>
      <KeyText>{tr('history.keyBars')}</KeyText>
      {item(<View style={{ width: 8, height: 11, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: color.accent }} />, tr('history.keyLast'))}
      {item(<View style={{ width: 1, height: 11, backgroundColor: color.muted }} />, tr('history.keyStep'))}
      <KeyText>{tr('history.keyTap')}</KeyText>
    </View>
  )
}

function KeyText({ children }: { children: string }) {
  return <Text variant="small" style={{ fontSize: 12 }}>{children}</Text>
}
