import type React from 'react'
import type { Metadata, Viewport } from 'next'
import {
  Plus_Jakarta_Sans,
  Space_Grotesk,
  Playfair_Display,
  Cormorant_Garamond,
  Fraunces,
  DM_Serif_Display,
  Cinzel_Decorative,
  Instrument_Serif,
  Syne,
  Abril_Fatface,
} from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
})
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-cormorant',
})
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' })
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-dm-serif',
})
const cinzel = Cinzel_Decorative({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-cinzel',
})
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument',
})
const syne = Syne({ subsets: ['latin'], variable: '--font-syne' })
const abril = Abril_Fatface({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-abril',
})

const fontVars = [
  jakarta,
  space,
  playfair,
  cormorant,
  fraunces,
  dmSerif,
  cinzel,
  instrument,
  syne,
  abril,
]
  .map((f) => f.variable)
  .join(' ')

export const metadata: Metadata = {
  title: 'reel spill',
  description:
    'Feed it a song, a BPM, lyrics and your footage. Reel spill cuts up to twelve lyric-synced vertical reels, editable after the fact.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background ${fontVars}`}>
      <body className="bg-background text-foreground antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
