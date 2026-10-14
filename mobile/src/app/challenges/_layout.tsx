/* Challenges: eigener Stack im Modal – Liste → Challenge (Bestwert, Versuche, Los) */
import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'

export default function Layout() {
  return <Stack screenOptions={stackScreenOptions} />
}
