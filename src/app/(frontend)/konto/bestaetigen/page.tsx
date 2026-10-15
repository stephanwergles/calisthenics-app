/* Link aus der Bestätigungsmail: bestätigt die Adresse (POST /api/users/verify/:token) und schickt
   zurück in die App. Kein Login hier – angemeldet wird in der App. */
import type { Metadata } from 'next'
import { Verify } from './verify'

export const metadata: Metadata = { title: 'E-Mail bestätigen · Lever', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  return <main className="account"><Verify token={token ?? ''} /></main>
}
