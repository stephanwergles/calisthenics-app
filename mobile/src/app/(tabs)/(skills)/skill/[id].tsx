/* Skill-Seite (Web: SkillDetail) – Push im Skills-Tab */
import { useLocalSearchParams } from 'expo-router'
import { SkillPage } from '@/screens/skills/skill-page'

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <SkillPage id={String(id)} />
}
