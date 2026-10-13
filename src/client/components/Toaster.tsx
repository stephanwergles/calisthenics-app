'use client'
/* Web-Toast: Glas-Kapsel oben, verschwindet nach 2,6 s (Fehler 4 s), Tipp schließt sofort.
   In der App zeichnet iOS den Toast selbst (toast.ts → nativeToast). */
import { useEffect, useState } from 'react'
import { onToast, type ToastMsg } from '../toast'
import { Icon } from './Icon'

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  useEffect(() => onToast(m => setMsg(m)), [])
  useEffect(() => {
    if (!msg) return
    const id = setTimeout(() => setMsg(null), msg.tone === 'error' ? 4000 : 2600)
    return () => clearTimeout(id)
  }, [msg])
  if (!msg) return null
  return (
    <div className={`toast ${msg.tone}`} role={msg.tone === 'error' ? 'alert' : 'status'} aria-live="polite" key={msg.id} onClick={() => setMsg(null)}>
      <Icon name={msg.tone === 'error' ? 'close' : 'check'} size={18} />
      <span>{msg.text}</span>
    </div>
  )
}
