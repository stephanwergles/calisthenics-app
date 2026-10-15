/* Link aus „Passwort vergessen“: neues Passwort festlegen (POST /api/users/reset-password),
   danach in der App anmelden. */
import type { Metadata } from 'next'
import { Reset } from './reset'

export const metadata: Metadata = { title: 'Neues Passwort · Lever', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <main className="account"><Reset token={token ?? ''} /></main>
}
