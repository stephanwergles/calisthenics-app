/* Progressions-Leiter (Web: SkillSheet) – Modal, auch vom Heute-Screen geöffnet */
import { Stack, useLocalSearchParams } from 'expo-router'
import { CloseButton } from '@/navigation'
import { Ladder } from '@/screens/skills/ladder'

export default function Screen() {
  const { pid, step } = useLocalSearchParams<{ pid: string; step?: string }>()
  return (
    <>
      {/* transparenter nativer Kopf nur für den Glas-Schließen-Button; Titel steht im Inhalt */}
      <Stack.Screen options={{ headerShown: true, headerTransparent: true, title: '', headerTitle: '', headerShadowVisible: false }} />
      <CloseButton />
      <Ladder pid={String(pid)} focus={step ? String(step) : undefined} />
    </>
  )
}
