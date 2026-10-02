import type { Metadata, Viewport } from 'next'
import React from 'react'
import './styles.css'

export const metadata: Metadata = {
  title: 'Calisthenics',
  description: 'Progressionsbasiertes Calisthenics-Training',
  appleWebApp: { capable: true, title: 'Calisthenics', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
  viewportFit: 'cover', themeColor: '#101010',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
