/* Ziele der Konto-Mails (Universal Links, gleiche Pfade wie auf der Webseite): /konto/bestaetigen,
   /konto/passwort. Auch ohne Konto erreichbar – sie stehen im Root-Layout außerhalb des Auth-Wrappers. */
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'

export default function Layout() {
  return <Stack screenOptions={stackScreenOptions} />
}
