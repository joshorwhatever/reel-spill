export type FontOption = {
  id: string
  name: string
  note: string
  /** CSS font-family stack usable on canvas + DOM */
  stack: string
  weight: number
  uppercase?: boolean
}

/** The 10 curated Google Fonts, loaded via next/font/google in app/layout.tsx */
export const GOOGLE_FONTS: FontOption[] = [
  {
    id: 'playfair',
    name: 'Playfair Display',
    note: 'Elegant editorial serif',
    stack: 'var(--font-playfair), Georgia, serif',
    weight: 700,
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    note: 'Classic high-end serif',
    stack: 'var(--font-cormorant), Garamond, serif',
    weight: 600,
  },
  {
    id: 'fraunces',
    name: 'Fraunces',
    note: 'Vintage display serif',
    stack: 'var(--font-fraunces), Georgia, serif',
    weight: 700,
  },
  {
    id: 'dm-serif',
    name: 'DM Serif Display',
    note: 'Luxury poster serif',
    stack: 'var(--font-dm-serif), Georgia, serif',
    weight: 400,
  },
  {
    id: 'cinzel',
    name: 'Cinzel Decorative',
    note: 'Bold luxury / all-caps',
    stack: 'var(--font-cinzel), Georgia, serif',
    weight: 700,
    uppercase: true,
  },
  {
    id: 'instrument',
    name: 'Instrument Serif',
    note: 'Condensed retro chic',
    stack: 'var(--font-instrument), Georgia, serif',
    weight: 400,
  },
  {
    id: 'syne',
    name: 'Syne',
    note: 'Super wide modern display',
    stack: 'var(--font-syne), sans-serif',
    weight: 800,
  },
  {
    id: 'abril',
    name: 'Abril Fatface',
    note: 'Heavy decorative display',
    stack: 'var(--font-abril), Georgia, serif',
    weight: 400,
  },
  {
    id: 'space',
    name: 'Space Grotesk',
    note: 'Minimal tech sans',
    stack: 'var(--font-space), sans-serif',
    weight: 600,
  },
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    note: 'Clean modern sans',
    stack: 'var(--font-jakarta), sans-serif',
    weight: 700,
  },
]

export function resolveFont(
  id: string,
  custom: { id: string; name: string; family: string }[],
): FontOption {
  const g = GOOGLE_FONTS.find((f) => f.id === id)
  if (g) return g
  const c = custom.find((f) => f.id === id)
  if (c) {
    return {
      id: c.id,
      name: c.name,
      note: 'Uploaded',
      stack: `"${c.family}", sans-serif`,
      weight: 400,
    }
  }
  return GOOGLE_FONTS[0]
}
