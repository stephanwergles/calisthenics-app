import { Stack } from 'expo-router'
import { stackScreenOptions } from '@/navigation'

/** Skill-Seiten liegen über der Übersicht – auch bei direktem Sprung auf /skill/[id] */
export const unstable_settings = { anchor: 'skills' }

export default function Layout() {
  return <Stack screenOptions={stackScreenOptions} />
}
