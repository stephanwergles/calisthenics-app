'use client'
/* Sheets in der iOS-App nativ zeigen: Komponente baut die Beschreibung, der Hook zeigt,
   aktualisiert (nur bei Änderung) und schließt beim Verschwinden. Im Browser ohne Wirkung. */
import { createContext, useContext, useEffect, useRef } from 'react'
import { nativePanel, nativeSheets, type NPanel, type NSheet, type PanelEvent, type SheetEvent } from './native'

/** true, sobald die native Hülle (Tab-Leiste, Sheets) läuft – setzt TrainingApp */
export const NativeShell = createContext(false)
export const useNativeShell = () => useContext(NativeShell)

export function useNativeSheet(spec: NSheet | null, onEvent: (e: SheetEvent) => void) {
  const handler = useRef(onEvent); handler.current = onEvent
  const id = spec?.id
  const json = spec ? JSON.stringify(spec) : ''
  const shown = useRef('')
  useEffect(() => {
    if (!id) return
    const off = nativeSheets.on(id, e => handler.current(e))
    return () => { off(); shown.current = ''; nativeSheets.close(id) }
  }, [id])
  useEffect(() => {
    if (!spec || json === shown.current) return
    shown.current = json
    nativeSheets.show(spec)
  }, [json]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Erfassungs-Panel im Training: zeigt/aktualisiert, solange spec gesetzt ist. Geschlossen wird
    zentral in TrainingApp (sonst flackert es bei jedem Satzwechsel, wenn die Komponente neu entsteht). */
export function usePanel(spec: NPanel | null, onEvent: (e: PanelEvent) => void) {
  const handler = useRef(onEvent); handler.current = onEvent
  const json = spec ? JSON.stringify(spec) : ''
  const active = !!spec
  useEffect(() => { if (active) return nativePanel.on(e => handler.current(e)) }, [active])
  useEffect(() => { if (spec) nativePanel.set(spec) }, [json]) // eslint-disable-line react-hooks/exhaustive-deps
}
