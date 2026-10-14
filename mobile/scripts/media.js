/* Erzeugt src/media/clips.generated.ts: require()-Tabellen der 3D-Clips und Standbilder aus
   ../public (die Web-App liefert dieselben Dateien aus). Metro bündelt nur, was statisch
   require()t wird – deshalb diese generierte Datei statt dynamischer Pfade.
   Läuft automatisch aus app.config.ts (start, prebuild, EAS) und per `npm run media`. */
const fs = require('fs')
const path = require('path')

const pub = path.resolve(__dirname, '../../public')
const out = path.resolve(__dirname, '../src/media/clips.generated.ts')

function list(dir, ext) {
  try { return fs.readdirSync(path.join(pub, dir)).filter(f => f.endsWith(ext)).map(f => f.slice(0, -ext.length)).sort() } catch { return [] }
}

function generate() {
  const clips = list('clips', '.mp4')
  const stills = list('clip-stills', '.jpg')
  const row = (dir, ext) => id => `  '${id}': require('../../../public/${dir}/${id}${ext}'),`
  const src = [
    '/* generiert von scripts/media.js – nicht von Hand ändern */',
    '/* eslint-disable */',
    'export const CLIPS: Record<string, number> = {',
    ...clips.map(row('clips', '.mp4')),
    '}',
    'export const STILLS: Record<string, number> = {',
    ...stills.map(row('clip-stills', '.jpg')),
    '}',
    '',
  ].join('\n')
  const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''
  if (prev !== src) fs.writeFileSync(out, src)
  return { clips: clips.length, stills: stills.length }
}

module.exports = { generate }
if (require.main === module) console.log(generate())
