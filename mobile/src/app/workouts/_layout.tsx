import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'

export default function Layout() {
  return <Stack screenOptions={stackScreenOptions} />
}
