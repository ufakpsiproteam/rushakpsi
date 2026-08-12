'use client'

import Link from 'next/link'

/**
 * Brother accounts are provisioned by invitation, not self-served.
 *
 * This page previously created a full brother account for anyone who
 * typed a single shared code that was hardcoded in the client bundle
 * (PRD S7 prohibits exactly this). It is kept as a signpost so existing
 * links and bookmarks land somewhere useful rather than 404ing.
 */
export default function BrotherAccountCreationPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="lettermark text-2xl">ΑΚΨ</p>
          <p className="page-eyebrow mt-2">Alpha Phi Chapter · University of Florida</p>
        </div>

        <div className="card card-pad">
          <h1 className="page-title text-xl">Brother accounts are by invitation</h1>
          <p className="page-subtitle">
            Brother accounts are created by an admin before recruitment opens. You&rsquo;ll receive
            a personal invitation link by email — it works once and expires.
          </p>

          <div className="alert mt-5">
            <p>
              Didn&rsquo;t get one? Message a Director of Recruitment in GroupMe with your full name
              and the email you want to use.
            </p>
          </div>

          <div className="flex flex-col gap-2 mt-6">
            <Link href="/auth/signin" className="btn btn-primary btn-block">
              I already have an account
            </Link>
            <Link href="/" className="btn btn-ghost btn-block">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
