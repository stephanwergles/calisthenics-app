/* Meine Workouts: eigener Stack im Modal. Liste → Editor → Übung hinzufügen / Umbenennen als
   Push-Seiten; Sätze und Reihenfolge einer Übung als Sheet mit Detents über dem Editor. */
import { Stack } from 'expo-router'
import { formSheet, stackScreenOptions } from '@/navigation'

export default function Layout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="slot" options={formSheet([0.5, 0.75])} />
    </Stack>
  )
}
