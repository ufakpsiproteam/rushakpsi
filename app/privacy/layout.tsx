import { portalFontVariables } from '@/lib/portalFonts'
import WaveBackground from '@/components/portal/WaveBackground'

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`portal-shell ${portalFontVariables}`}>
      <WaveBackground />
      {children}
    </div>
  )
}
