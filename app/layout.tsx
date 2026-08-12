import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import ProFloatingMenu from '@/components/pro/ProFloatingMenu'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#F4F4F5',
}

export const metadata: Metadata = {
  // Basic metadata
  title: 'AKΨ Recruitment - University of Florida',
  description: 'Alpha Kappa Psi Professional Business Fraternity - UF Chapter Recruitment',

  // PWA configuration
  applicationName: 'AKΨ',
  manifest: '/manifest.json',

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/og-image.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // iOS-specific settings
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AKΨ',
  },

  // Open Graph (social sharing)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://recruitment.ufakpsi.com',
    siteName: 'AKΨ Recruitment',
    title: 'AKΨ Recruitment - University of Florida',
    description: 'Alpha Kappa Psi Professional Business Fraternity - UF Chapter Recruitment',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AKΨ Recruitment',
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: 'AKΨ Recruitment - University of Florida',
    description: 'Alpha Kappa Psi Professional Business Fraternity - UF Chapter Recruitment',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <ProFloatingMenu />
        </AuthProvider>
      </body>
    </html>
  )
}
