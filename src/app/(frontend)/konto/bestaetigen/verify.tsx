'use client'
import { useEffect, useState } from 'react'

type State = 'busy' | 'ok' | 'error'

export function Verify({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? 'busy' : 'error')
  useEffect(() => {
    if (!token) return
    fetch(`/api/users/verify/${encodeURIComponent(token)}`, { method: 'POST' })
      .then(r => setState(r.ok ? 'ok' : 'error'))
      .catch(() => setState('error'))
  }, [token])
  return (
    <>
      <p className="eyebrow">Lever</p>
      {state === 'busy' && <h1 className="display">Einen Moment …</h1>}
      {state === 'ok' && <>
        <h1 className="display">E-Mail <span>bestätigt.</span></h1>
        <p>Dein Konto ist bereit. Zurück in der App meldest du dich mit deiner E-Mail-Adresse und deinem Passwort an.</p>
      </>}
      {state === 'error' && <>
        <h1 className="display">Link ungültig.</h1>
        <p>Der Link ist abgelaufen oder wurde schon benutzt. Ist dein Konto bereits bestätigt, melde dich einfach in der App an.</p>
      </>}
    </>
  )
}
