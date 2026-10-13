'use client'
/* Hinweis beim ersten Start und Einwilligung in die Gesundheitsdaten (Art. 9 DSGVO).
   Ohne Einwilligung bleibt alles auf dem Gerät – der Abgleich pausiert, die App läuft weiter. */
import { useState } from 'react'
import type { Training } from '../useTraining'
import { DISCLAIMER, DISCLAIMER_VERSION, HEALTH_CONSENT, HEALTH_CONSENT_VERSION, PRIVACY_URL } from '../consent'
import { useNativeShell, useNativeSheet } from '../useNativeSheet'
import { Sheet } from './Sheets'

export function ConsentGate({ t }: { t: Training }) {
  const native = useNativeShell()
  const [later, setLater] = useState(false)   // „Später“ gilt bis zum nächsten App-Start
  const [busy, setBusy] = useState(false)
  const showDisclaimer = t.consent.disclaimer !== DISCLAIMER_VERSION
  const showHealth = !showDisclaimer && !!t.sync.account && t.consent.health !== HEALTH_CONSENT_VERSION && !later
  const accept = async () => {
    setBusy(true)
    try { await t.acceptHealthConsent() } catch (e) { alert(`Speichern fehlgeschlagen: ${(e as Error).message}`) } finally { setBusy(false) }
  }

  useNativeSheet(native && showDisclaimer ? {
    id: 'disclaimer', title: DISCLAIMER.title, detents: ['auto'],
    blocks: [{ type: 'text', text: DISCLAIMER.text }],
    footer: [{ id: 'ok', title: DISCLAIMER.ok, symbol: 'checkmark', style: 'prominent' }],
  } : null, () => t.acceptDisclaimer())   // reiner Hinweis: auch Wegwischen gilt als gelesen

  useNativeSheet(native && showHealth ? {
    id: 'health-consent', title: HEALTH_CONSENT.title, detents: ['auto', 'large'],
    blocks: [
      { type: 'text', text: HEALTH_CONSENT.text },
      { type: 'button', id: 'privacy', title: 'Datenschutzerklärung', symbol: 'doc.text' },
    ],
    footer: [{ id: 'later', title: 'Später' }, { id: 'ok', title: HEALTH_CONSENT.ok, symbol: 'checkmark', style: 'prominent' }],
  } : null, e => {
    if (e.id === 'ok') void accept()
    else if (e.id === 'privacy') window.open(PRIVACY_URL, '_blank')
    else if (e.type === 'dismiss' || e.id === 'later') setLater(true)
  })

  if (native) return null
  if (showDisclaimer) return (
    <Sheet title={DISCLAIMER.title} onClose={t.acceptDisclaimer}>
      <p className="consent-text">{DISCLAIMER.text}</p>
      <button className="btn btn-primary btn-block" onClick={t.acceptDisclaimer}>{DISCLAIMER.ok}</button>
    </Sheet>
  )
  if (showHealth) return (
    <Sheet title={HEALTH_CONSENT.title} onClose={() => setLater(true)}>
      <p className="consent-text">{HEALTH_CONSENT.text}</p>
      <p className="consent-text"><a href={PRIVACY_URL} target="_blank" rel="noopener">Datenschutzerklärung</a></p>
      <div className="sheet-actions">
        <button className="btn btn-secondary" onClick={() => setLater(true)}>Später</button>
        <button className="btn btn-primary grow" disabled={busy} onClick={() => void accept()}>{HEALTH_CONSENT.ok}</button>
      </div>
    </Sheet>
  )
  return null
}
