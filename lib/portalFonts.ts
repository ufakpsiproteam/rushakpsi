import { Bodoni_Moda, Sora, Nunito } from 'next/font/google'

export const portalDisplayFont = Bodoni_Moda({
  subsets: ['latin'],
  weight: '500',
  style: 'italic',
  variable: '--font-portal-display',
  display: 'swap',
})

export const portalBodyFont = Sora({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-portal-body',
  display: 'swap',
})

export const portalSubheadingFont = Nunito({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-portal-subheading',
  display: 'swap',
})

export const portalFontVariables = `${portalDisplayFont.variable} ${portalBodyFont.variable} ${portalSubheadingFont.variable}`
