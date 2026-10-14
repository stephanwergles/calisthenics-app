/* Live Activity der laufenden Session: Sperrbildschirm und Dynamic Island (expo-widgets).
   Während einer Pause zählt der Countdown selbstständig herunter (SwiftUI-Timer – läuft auch,
   wenn die App schläft), sonst zeigt sie die Trainingsdauer. Tippen öffnet das Training.

   Achtung 'widget'-Direktive: Die Funktion läuft isoliert in der Widget-Erweiterung – nur
   @expo/ui/swift-ui-Bausteine, keine Hooks, keine Werte von außerhalb der Funktion. Alles kommt
   über die Props (Zeiten als Millisekunden, Texte schon übersetzt). */
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { font, foregroundStyle, frame, labelsHidden, lineLimit, monospacedDigit, multilineTextAlignment, padding, tint } from '@expo/ui/swift-ui/modifiers'
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets'

export interface SessionActivityProps {
  /** Beginn der Session (ms) – für die Trainingsdauer */
  start: number
  /** laufende Pause: Beginn und Ende (ms); ohne = keine Pause */
  restStart?: number
  restEnd?: number
  /** „PAUSE“ / „TRAINING“ (übersetzt) */
  label: string
  /** Workout-Name */
  title: string
  /** was als Nächstes kommt, z. B. „Satz 2 von 3 · Ring-Flys“ */
  line: string
  /** erledigte / geplante Sätze */
  done: number
  total: number
}

const SessionActivity = (p: SessionActivityProps, env: LiveActivityEnvironment) => {
  'widget'
  const VOLT = '#D4FF3A'
  const MUTED = '#9A9A9A'
  const accent = env.isLuminanceReduced ? '#FFFFFF' : VOLT
  const resting = !!p.restStart && !!p.restEnd
  const rest = resting ? { lower: new Date(p.restStart!), upper: new Date(p.restEnd!) } : undefined
  // Trainingsdauer: Zähler aufwärts ab Session-Beginn (obere Grenze weit in der Zukunft)
  const elapsed = { lower: new Date(p.start), upper: new Date(p.start + 12 * 3600 * 1000) }
  // Timertexte nehmen in SwiftUI die volle Breite ein – feste, rechtsbündige Breite je Größe
  const clock = (size: number, weight: 'bold' | 'heavy' = 'heavy', width = size * 3) => {
    const mods = [font({ size, weight, design: 'rounded' as const }), monospacedDigit(), multilineTextAlignment('trailing'), frame({ width, alignment: 'trailing' })]
    return resting
      ? <Text timerInterval={rest} countsDown={true} modifiers={[...mods, foregroundStyle(accent)]} />
      : <Text timerInterval={elapsed} countsDown={false} modifiers={[...mods, foregroundStyle('#FFFFFF')]} />
  }
  const symbol = resting ? 'timer' : 'figure.strengthtraining.traditional'
  const bar = resting
    ? <ProgressView timerInterval={rest} countsDown={true} modifiers={[tint(accent), labelsHidden()]} />
    : <ProgressView value={p.total ? p.done / p.total : 0} modifiers={[tint(accent), labelsHidden()]} />

  return {
    banner: (
      <VStack spacing={10} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(accent)]}>{p.label}</Text>
            <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.title}</Text>
            <Text modifiers={[font({ size: 14 }), foregroundStyle(MUTED), lineLimit(1)]}>{p.line}</Text>
          </VStack>
          <Spacer />
          {clock(40)}
        </HStack>
        {bar}
      </VStack>
    ),
    compactLeading: <Image systemName={symbol} color={accent} />,
    compactTrailing: clock(15, 'bold', 52),
    minimal: <Image systemName={symbol} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 6, top: 6 })]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(accent)]}>{p.label}</Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#FFFFFF'), lineLimit(1)]}>{p.title}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" modifiers={[padding({ trailing: 6, top: 6 })]}>{clock(30)}</VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ leading: 6, trailing: 6, bottom: 6 })]}>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(MUTED), lineLimit(1)]}>{p.line}</Text>
        {bar}
      </VStack>
    ),
  }
}

export default createLiveActivity<SessionActivityProps>('LeverSession', SessionActivity)
