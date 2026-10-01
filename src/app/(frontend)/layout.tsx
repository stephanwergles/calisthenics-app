import React from 'react'
import './styles.css'

export const metadata = {
  title: 'Calisthenics',
  description: 'Progressionsbasiertes Calisthenics-Training',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
