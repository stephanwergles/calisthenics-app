import type { Metadata, Viewport } from 'next'
import React from 'react'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import './styles.css'

export const metadata: Metadata = {
  title: 'Lever',
  description: 'Lever – progressionsbasiertes Calisthenics-Training',
  icons: { apple: '/apple-touch-icon.png?v=4', icon: [{ url: '/favicon.svg?v=4', type: 'image/svg+xml' }, { url: '/icon-512.png?v=4', sizes: '512x512' }] },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#101010',
}

/* Schrift wird beim Build geladen und selbst ausgeliefert (/_next/static) – keine Anfrage an Google */
const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' })
const display = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800', '900'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  )
}
