'use client'
import { useState } from 'react'
import type { Training } from '../useTraining'
import { APP_VERSION } from '../version'

export function DataView({ t }: { t: Training }) {
  const [msg, setMsg] = useState<string[] | null>(null)
  const sets = t.sessions.reduce((n, s) => n + s.sets.length, 0)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const v1 = JSON.parse(await file.text())
      if (!v1 || typeof v1.log !== 'object') throw new Error('Kein v1-Export')
      if (!confirm('v1-Export übernehmen? Einheiten mit gleichem Datum und Workout werden ersetzt, alle anderen bleiben. Der Trainingsstand wird aus dem Export übernommen.')) return
      const r = await t.importV1(v1)
      setMsg([
        `Übernommen: ${r.sessions} Einheiten, ${r.sets} Sätze, ${r.activities} Aktivitäten.`,
        ...(r.dropped.length ? [`${r.dropped.length} leere Tage verworfen.`] : []),
        ...r.warnings.map(w => `Hinweis: ${w}`),
      ])
    } catch (e) {
      setMsg([`Import fehlgeschlagen: ${(e as Error).message}`])
    }
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(t.exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `calisthenics-v2-${t.today}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <section className="data">
      <div className="card">
        <h2>Auf diesem Gerät</h2>
        <p className="meta">{t.sessions.length} Einheiten · {sets} Sätze · {t.activities.length} Aktivitäten</p>
        {!t.persistent && <p className="warn">Dieser Browser erlaubt keinen dauerhaften Speicher – Daten gehen beim Schließen verloren.</p>}
        <p className="hint">Noch ohne Sync: Die Daten liegen nur hier. Der Abgleich mit dem Server ist der nächste Ausbauschritt.</p>
      </div>
      <div className="card">
        <h2>Aus v1 übernehmen</h2>
        <p className="hint">Den JSON-Export aus der bisherigen App wählen. Wiederholbar – gleiche Einheiten werden ersetzt, nicht verdoppelt.</p>
        <label className="btn btn-secondary btn-block">
          v1-Export wählen
          <input type="file" accept="application/json,.json" hidden onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {msg && <ul className="result">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </div>
      <div className="card">
        <h2>Sichern</h2>
        <button className="btn btn-secondary btn-block" onClick={download}>Export (JSON)</button>
        <a className="btn btn-ghost btn-block" href="/admin">Katalog verwalten →</a>
      </div>
      <p className="version">v{APP_VERSION}</p>
    </section>
  )
}
