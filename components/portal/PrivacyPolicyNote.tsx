import Link from 'next/link'

export default function PrivacyPolicyNote({ variant = 'signin' }: { variant?: 'signin' | 'account' }) {
  return (
    <p className="text-xs text-ink-subtle">
      {variant === 'signin' ? (
        <>
          By signing in, you agree to our{' '}
          <Link href="/privacy" className="underline hover:text-ink-muted">
            Privacy Policy
          </Link>
          .
        </>
      ) : (
        <Link href="/privacy" className="underline hover:text-ink-muted">
          View our Privacy Policy
        </Link>
      )}
    </p>
  )
}
