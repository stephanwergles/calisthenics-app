'use client'
/* Übung zeigen: 3D-Clip (public/clips/<exercise-id>.mp4, Liste in src/seed/clips.json), sonst die
   Kreide-Skizze. Das Video bleibt unsichtbar, bis das erste Bild da ist – kein schwarzes Aufblitzen;
   schlägt es fehl (z. B. offline im Browser), bleibt die Skizze. Bei reduzierter Bewegung: Standbild. */
import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '@/domain/model'
import clips from '@/seed/clips.json'
import { Sketch } from './Sketch'
import { Icon } from './Icon'

const CLIPS = new Set((clips as { clips: string[] }).clips)
const STILLS = new Set((clips as { stills: string[] }).stills)
export const hasClip = (id: string) => CLIPS.has(id)

/** Clip läuft dreimal und bleibt dann auf der Schlüsselposition stehen (Strom sparen);
    Tipp darauf spielt ihn wieder dreimal ab. */
const RUNS = 3
export function ExerciseMedia({ exercise, label }: { exercise: Exercise; label: string }) {
  const clip = CLIPS.has(exercise.id)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [playing, setPlaying] = useState(true)
  const runs = useRef(0)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => { setState('loading'); setPlaying(true); runs.current = 0 }, [exercise.id])
  const still = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const rest = (v: HTMLVideoElement) => { v.pause(); v.currentTime = 1; setPlaying(false) }
  useEffect(() => {
    const v = video.current
    if (!v || state !== 'ready') return
    if (still()) rest(v); else void v.play().catch(() => setPlaying(false))
  }, [state])
  const onEnded = () => {
    const v = video.current
    if (!v) return
    runs.current++
    if (runs.current < RUNS) { v.currentTime = 0; void v.play().catch(() => undefined) } else rest(v)
  }
  const replay = () => {
    const v = video.current
    if (!v || playing) return
    runs.current = 0; setPlaying(true); v.currentTime = 0; void v.play().catch(() => setPlaying(false))
  }

  if (!clip || state === 'failed') return <Sketch id={exercise.media.sketch} label={label} />
  return (
    <button type="button" className={`clip${state === 'ready' ? ' ready' : ''}${playing ? '' : ' stopped'}`} onClick={replay}
      aria-label={playing ? label : `${label} – nochmal abspielen`}>
      {state !== 'ready' && <Sketch id={exercise.media.sketch} label="" />}
      <video key={exercise.id} ref={video} src={`/clips/${exercise.id}.mp4`} muted playsInline autoPlay preload="auto"
        aria-hidden="true" disablePictureInPicture tabIndex={-1}
        onLoadedData={() => setState('ready')} onEnded={onEnded} onError={() => setState('failed')} />
      {!playing && state === 'ready' && <span className="clip-replay" aria-hidden="true"><Icon name="undo" size={18} /></span>}
    </button>
  )
}

/** Standbild aus dem Clip (Schlüsselposition nach 1 s = Mitte der Bewegung), sonst die Skizze.
    Kein eigenes Bild nötig – neue Clips bringen ihr Standbild automatisch mit. Rein dekorativ. */
export function ExerciseStill({ exercise, className }: { exercise: Exercise; className?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { setReady(false) }, [exercise.id])
  if (!CLIPS.has(exercise.id)) return <Sketch id={exercise.media.sketch} label="" />
  // Standbild als Datei (public/clip-stills) – viele Videos gleichzeitig lädt iOS nicht zuverlässig
  if (STILLS.has(exercise.id)) return (
    <img key={exercise.id} className={`still${ready ? ' ready' : ''}${className ? ` ${className}` : ''}`} src={`/clip-stills/${exercise.id}.jpg`}
      alt="" aria-hidden="true" decoding="async" onLoad={() => setReady(true)}
      // aus dem Cache ist das Bild oft schon fertig, bevor React onLoad anhängt
      ref={el => { if (el?.complete && el.naturalWidth && !ready) setReady(true) }} />
  )
  return (
    <video key={exercise.id} className={`still${ready ? ' ready' : ''}${className ? ` ${className}` : ''}`}
      src={`/clips/${exercise.id}.mp4#t=1`} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} disablePictureInPicture
      onLoadedMetadata={e => { e.currentTarget.currentTime = 1 }} onSeeked={() => setReady(true)} onError={() => setReady(false)} />
  )
}
