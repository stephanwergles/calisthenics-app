/* Landingpage. Trainiert wird in der App (mobile/, Expo) – der Server liefert API, Sync, Admin
   und diese öffentlichen Seiten. */
import { WORD_LETTERS, WORD_MARK, WORD_VIEWBOX } from '@/client/brandPaths'
import { APP_VERSION } from '@/client/version'

export default function Page() {
  return (
    <main className="landing">
      <svg className="word" viewBox={WORD_VIEWBOX} fill="currentColor" role="img" aria-label="Lever">
        <path d={WORD_MARK[0]} />
        <path d={WORD_MARK[1]} />
        {WORD_LETTERS.map(([x, d]) => <path key={x} transform={`translate(${x} 700) scale(1 -1)`} d={d} />)}
      </svg>
      <h1 className="display">Calisthenics<br /><span>mit Plan.</span></h1>
      <p>Jede Übung ist eine Stufe auf dem Weg zu deinem Skill – vom ersten Klimmzug bis zum Muscle-up, Front Lever oder Handstand.</p>
      <span className="badge">iPhone-App · Beta</span>
      <footer>
        <a href="/datenschutz">Datenschutz</a>
        <span>v{APP_VERSION}</span>
      </footer>
    </main>
  )
}
