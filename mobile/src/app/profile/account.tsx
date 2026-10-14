/* Profil › Push-Seite – Inhalt in screens/profile/account.tsx */
import { AccountPage } from '@/screens/profile/account'
import { CloseIfRoot } from '@/navigation'

export default function Screen() {
  return <><CloseIfRoot /><AccountPage /></>
}
