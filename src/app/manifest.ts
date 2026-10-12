import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lever – Calisthenics',
    short_name: 'Lever',
    start_url: '/',
    display: 'standalone',
    background_color: '#101010',
    theme_color: '#101010',
    lang: 'de',
    icons: [{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  }
}
