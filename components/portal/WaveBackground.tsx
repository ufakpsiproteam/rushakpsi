/**
 * Ambient wave background for the AKΨ portal theme. Fixed behind all
 * content, never intercepts pointer events. Fully static — no motion.
 */
export default function WaveBackground() {
  return (
    <div className="portal-wave-bg" aria-hidden="true">
      <div className="portal-wave-panel">
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="portalWaveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--portal-surface)" />
              <stop offset="45%" stopColor="var(--portal-blue-light)" />
              <stop offset="78%" stopColor="var(--portal-navy-mid)" />
              <stop offset="100%" stopColor="var(--portal-navy-dark)" />
            </linearGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#portalWaveGradient)" opacity="0.55" />
          <path
            d="M0,620 C280,520 420,700 720,640 C1020,580 1140,460 1440,540 L1440,900 L0,900 Z"
            fill="var(--portal-navy-mid)"
            opacity="0.3"
          />
          <path
            d="M0,700 C320,640 500,780 760,720 C1040,660 1180,560 1440,660 L1440,900 L0,900 Z"
            fill="var(--portal-navy-dark)"
            opacity="0.4"
          />
          <path
            d="M0,780 C300,740 560,840 820,800 C1100,760 1220,700 1440,760 L1440,900 L0,900 Z"
            fill="var(--portal-navy-dark)"
            opacity="0.6"
          />
        </svg>
      </div>
    </div>
  )
}
