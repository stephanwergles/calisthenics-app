'use client'
import { useState, type FormEvent } from 'react'

const MIN = 8

export function Reset({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [state, setState] = useState<'form' | 'busy' | 'ok' | 'error'>(token ? 'form' : 'error')
  const [hint, setHint] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN) return setHint(`Mindestens ${MIN} Zeichen.`)
    if (password !== repeat) return setHint('Die beiden Passwörter stimmen nicht überein.')
    setHint(''); setState('busy')
    const r = await fetch('/api/users/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
    }).catch(() => null)
    setState(r?.ok ? 'ok' : 'error')
  }

  if (state === 'ok') return <>
    <p className="eyebrow">Lever</p>
    <h1 className="display">Passwort <span>gespeichert.</span></h1>
    <p>Melde dich jetzt in der App mit dem neuen Passwort an.</p>
  </>
  if (state === 'error') return <>
    <p className="eyebrow">Lever</p>
    <h1 className="display">Link ungültig.</h1>
    <p>Der Link ist abgelaufen (er gilt eine Stunde) oder wurde schon benutzt. Fordere in der App unter „Passwort vergessen“ einen neuen an.</p>
  </>
  return (
    <form onSubmit={submit}>
      <p className="eyebrow">Lever</p>
      <h1 className="display">Neues <span>Passwort.</span></h1>
      <label>Neues Passwort
        <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={MIN} />
      </label>
      <label>Wiederholen
        <input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} required minLength={MIN} />
      </label>
      {hint && <p className="hint" role="alert">{hint}</p>}
      <button type="submit" disabled={state === 'busy'}>{state === 'busy' ? 'Speichern …' : 'Passwort speichern'}</button>
    </form>
  )
}
