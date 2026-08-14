import { portalFontVariables } from '@/lib/portalFonts'
import WaveBackground from '@/components/portal/WaveBackground'

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`portal-shell ${portalFontVariables}`}>
      <WaveBackground />
      {children}
    </div>
  )
}
