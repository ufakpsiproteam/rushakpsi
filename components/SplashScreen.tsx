'use client'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="animate-splash-logo">
        <img
          src="/splash-icon.png"
          alt="AKPsi"
          className="w-48 h-48 sm:w-64 sm:h-64"
        />
      </div>
    </div>
  )
}
