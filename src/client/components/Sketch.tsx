import sketches from '@/seed/sketches.json'

const SKETCHES = sketches as Record<string, string>

/** Kreide-Skizze aus v1 (src/seed/sketches.json, erzeugt von catalog:extract).
    Der Inhalt stammt aus dem Repo, nicht vom Server – der Katalog liefert nur den Schlüssel.
    Farben per CSS: .f = Figur (Kreide), .a = Gerät (Akzent). */
/** label leer = rein dekorativ */
export function Sketch({ id, label }: { id?: string; label: string }) {
  const inner = id ? SKETCHES[id] : undefined
  if (!inner) return null
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return <svg className="sketch" viewBox="0 0 120 90" {...a11y} dangerouslySetInnerHTML={{ __html: inner }} />
}
