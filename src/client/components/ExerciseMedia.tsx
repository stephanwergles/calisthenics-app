'use client'
/* Übung zeigen: 3D-Clip (public/clips/<exercise-id>.mp4, Liste in src/seed/clips.json), sonst die
   Kreide-Skizze. Das Video bleibt unsichtbar, bis das erste Bild da ist – kein schwarzes Aufblitzen;
   schlägt es fehl (z. B. offline im Browser), bleibt die Skizze. Bei reduzierter Bewegung: Standbild. */
import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '@/domain/model'
import clips from '@/seed/clips.json'
import { Sketch } from './Sketch'

const CLIPS = new Set((clips as { clips: string[] }).clips)
const STILLS = new Set((clips as { stills: string[] }).stills)
export const hasClip = (id: string) => CLIPS.has(id)

export function ExerciseMedia({ exercise, label }: { exercise: Exercise; label: string }) {
  const clip = CLIPS.has(exercise.id)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => { setState('loading') }, [exercise.id])
  useEffect(() => {
    const v = video.current
    if (!v || state !== 'ready') return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still) { v.pause(); v.currentTime = 0.8 } else void v.play().catch(() => undefined)
  }, [state])

  if (!clip || state === 'failed') return <Sketch id={exercise.media.sketch} label={label} />
  return (
    <div className={`clip${state === 'ready' ? ' ready' : ''}`}>
      {state !== 'ready' && <Sketch id={exercise.media.sketch} label="" />}
      <video key={exercise.id} ref={video} src={`/clips/${exercise.id}.mp4`} muted loop playsInline autoPlay preload="auto"
        aria-label={label} role="img" disablePictureInPicture
        onLoadedData={() => setState('ready')} onError={() => setState('failed')} />
    </div>
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
