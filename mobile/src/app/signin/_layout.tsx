/* Anmeldebereich als eigener Stack: native Glas-Knöpfe im Kopf (Zurück, Registrieren). Ohne Konto
   die einzige Route der App (Auth-Wrapper per Stack.Protected im Root-Layout). */
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'

export default function Layout() {
  return <Stack screenOptions={stackScreenOptions} />
}
