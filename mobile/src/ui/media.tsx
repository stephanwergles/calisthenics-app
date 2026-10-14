/* Übung zeigen: 3D-Clip (public/clips, gebündelt über src/media/clips.generated.ts), sonst die
   Kreide-Skizze aus v1 (src/seed/sketches.json), sonst ein Symbol.
   Der Clip läuft dreimal und bleibt dann auf der Schlüsselposition stehen (Strom sparen);
   Tippen spielt ihn wieder ab. Mit „Bewegung reduzieren“ nur das Standbild. */
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { useEvent } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { SvgXml } from 'react-native-svg'
import type { Exercise } from '@lever/domain/model.ts'
import sketches from '@lever/seed/sketches.json'
import { t } from '@lever/core/i18n/index.ts'
import { CLIPS, STILLS } from '@/media/clips.generated'
import { Icon } from './icon'
import { color, radius } from './theme'

const SKETCHES = sketches as Record<string, string>
export const hasClip = (id: string) => id in CLIPS
export const hasStill = (id: string) => id in STILLS || id in CLIPS

/** v1-Skizze: CSS-Klassen (f = Figur, a = Gerät) in SVG-Attribute übersetzen */
function sketchXml(id: string) {
  const inner = SKETCHES[id]
  if (!inner) return null
  const body = inner
    .replace(/class="f"/g, `stroke="${color.chalk}" stroke-width="5" fill="none"`)
    .replace(/class="a"/g, `stroke="${color.accent}" stroke-width="4" fill="none"`)
  return `<svg viewBox="0 0 120 90" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

export function Sketch({ id, style }: { id?: string; style?: StyleProp<ViewStyle> }) {
  const xml = id ? sketchXml(id) : null
  if (!xml) return null
  return <View style={style} accessibilityElementsHidden><SvgXml xml={xml} width="100%" height="100%" /></View>
}

let reduceMotion = false
void AccessibilityInfo.isReduceMotionEnabled().then(v => { reduceMotion = v }).catch(() => undefined)

/** Standbild (Kacheln, Listen): Bild aus clip-stills, sonst Skizze, sonst Symbol */
export function ExerciseStill({ exercise, style, size = 30 }: { exercise: Exercise; style?: StyleProp<ViewStyle>; size?: number }) {
  const still = STILLS[exercise.id]
  const box: ViewStyle = { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }
  if (still) return (
    <View style={[box, style]} accessibilityElementsHidden>
      <Image source={still} style={{ width: '100%', height: '100%' }} contentFit="cover" contentPosition={{ top: '20%' }} transition={150} />
    </View>
  )
  const xml = sketchXml(exercise.media?.sketch ?? '')
  return (
    <View style={[box, style]} accessibilityElementsHidden>
      {xml ? <View style={{ width: '80%', height: '70%' }}><SvgXml xml={xml} width="100%" height="100%" /></View> : <Icon name="figure" size={size} color={color.muted} />}
    </View>
  )
}

const RUNS = 3
/** Großes Übungsbild (Fokus-Screen): Clip mit Wiederholung, sonst Standbild/Skizze */
export function ExerciseMedia({ exercise, style, label }: { exercise: Exercise; style?: StyleProp<ViewStyle>; label?: string }) {
  const clip = CLIPS[exercise.id]
  if (!clip) return <ExerciseStill exercise={exercise} style={[{ borderRadius: radius.card }, style]} size={44} />
  return <Clip key={exercise.id} source={clip} style={style} label={label ?? exercise.name} />
}

function Clip({ source, style, label }: { source: number; style?: StyleProp<ViewStyle>; label: string }) {
  const runs = useRef(0)
  const [stopped, setStopped] = useState(false)
  const player = useVideoPlayer(source, p => {
    p.muted = true
    p.loop = false
    if (reduceMotion) { p.currentTime = 1; setStopped(true) } else p.play()
  })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      runs.current++
      if (runs.current < RUNS) { player.currentTime = 0; player.play() } else { player.currentTime = 1; setStopped(true) }
    })
    return () => sub.remove()
  }, [player])
  const replay = () => {
    if (!stopped) return
    runs.current = 0; setStopped(false); player.currentTime = 0; player.play()
  }
  return (
    <Pressable onPress={replay} accessibilityRole="image" accessibilityLabel={stopped ? t('app.replay', { label }) : label}
      style={[{ overflow: 'hidden', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: color.card }, style]}>
      <VideoView player={player} nativeControls={false} contentFit="cover" allowsPictureInPicture={false}
        style={{ width: '100%', height: '100%', opacity: status === 'readyToPlay' ? 1 : 0 }} />
      {stopped && (
        <View style={{ position: 'absolute', right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="undo" size={16} />
        </View>
      )}
    </Pressable>
  )
}
