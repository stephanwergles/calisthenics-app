/* Welche Übungen haben einen 3D-Clip? Liest public/clips/<exercise-id>.mp4 und schreibt die
   Liste nach src/seed/clips.json – die App fragt so nie ein fehlendes Video an.
   Läuft vor jedem Build (npm run build, native:build); Clips kommen aus art/ (README, „Marke & 3D“). */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../public/clips/', import.meta.url)
const target = new URL('../src/seed/clips.json', import.meta.url)
const ids = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.mp4')).map(f => f.slice(0, -4)).sort() : []
const json = JSON.stringify(ids, null, 2) + '\n'
if (!existsSync(target) || readFileSync(target, 'utf8') !== json) writeFileSync(target, json)
console.log(`3D-Clips: ${ids.length}`)
