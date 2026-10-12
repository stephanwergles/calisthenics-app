/* 3D-Clips für die App vorbereiten:
   1. Standbild je Clip (Schlüsselposition nach 1 s) als public/clip-stills/<id>.jpg – mit ffmpeg,
      nur wenn es fehlt oder älter als der Clip ist. Ohne ffmpeg (z. B. auf dem Server) wird
      dieser Schritt übersprungen; die Standbilder liegen dann schon im Repo.
   2. src/seed/clips.json: welche Übungen Clip bzw. Standbild haben – die App fragt nie ins Leere.
   Läuft vor dev/build/native:build; Clips kommen aus art/ (README, „Marke & 3D“). */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'

const clipsDir = new URL('../public/clips/', import.meta.url)
const stillsDir = new URL('../public/clip-stills/', import.meta.url)
const target = new URL('../src/seed/clips.json', import.meta.url)
const ids = existsSync(clipsDir) ? readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).map(f => f.slice(0, -4)).sort() : []

let ffmpeg = true
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch { ffmpeg = false }
let made = 0
if (ffmpeg) {
  mkdirSync(stillsDir, { recursive: true })
  for (const id of ids) {
    const clip = new URL(`${id}.mp4`, clipsDir), still = new URL(`${id}.jpg`, stillsDir)
    if (existsSync(still) && statSync(still).mtimeMs >= statSync(clip).mtimeMs) continue
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', clip.pathname, '-frames:v', '1', '-q:v', '4', still.pathname])
    made++
  }
}
const stills = existsSync(stillsDir) ? readdirSync(stillsDir).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)).sort() : []
const json = JSON.stringify({ clips: ids, stills }, null, 2) + '\n'
if (!existsSync(target) || readFileSync(target, 'utf8') !== json) writeFileSync(target, json)
console.log(`3D-Clips: ${ids.length}, Standbilder: ${stills.length}${made ? ` (${made} neu)` : ''}`)
