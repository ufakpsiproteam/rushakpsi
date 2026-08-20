'use client'

import { useState } from 'react'

interface DecisionLetterProps {
  type: 'invite-accept' | 'invite-reject' | 'bid-accept' | 'bid-reject'
  rusheeName: string
  vpName: string
  chapterName: string
}

export default function DecisionLetter({ type, rusheeName, vpName }: DecisionLetterProps) {
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showBidAcceptanceModal, setShowBidAcceptanceModal] = useState(false)
  const letterContent: Record<
    DecisionLetterProps['type'],
    {
      greeting: string
      body: Array<React.ReactNode>
      nextSteps: Array<React.ReactNode> | null
      importantNote?: React.ReactNode
      closing: string | null
    }
  > = {
    'invite-accept': {
    greeting: `Hello ${rusheeName}!`,
    body: [
      <>
        On behalf of Alpha Kappa Psi, we would like to congratulate you on being
        invited to Professional Interviews and our Invite-Only Event.
      </>,
      <>
        Recruitment has been extremely competitive this semester, and you have
        made a strong impression on the brotherhood thus far. That being said,
        there is one more step before we determine whether you will be offered a bid.
      </>,
      <>
        Attendance at the Invite-Only Event is <strong>mandatory</strong>, as it
        will be your final opportunity to make an impression prior to interviews.
        If you have an exam conflict, please notify us as soon as possible.
      </>,
      <>
        The dress code for both the Invite-Only Event and Professional Interviews
        is <strong>business professional</strong>.
      </>,
    ],
    nextSteps: [
      <>Please complete the Recruitment {' '}
        <button
          onClick={() => setShowConfirmationModal(true)}
          className="underline text-ink hover:text-ink cursor-pointer"
        >
          Confirmation Form</button></>,
      <>
        Sign up for interviews using the following {' '}
        <a
          href="https://docs.google.com/spreadsheets/d/1n2wDxGgNxCdOsXMeARDI8x791CWhSpid-4M4dIdite0/edit?usp=sharing"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          link
        </a>
      </>,
    ],
    closing:
      'Again, congratulations on making it this far in the process. We look forward to seeing you soon.',
  },
    'invite-reject': {
    greeting: `Hello ${rusheeName},`,
    body: [
      <>
        Thank you for your interest in Alpha Kappa Psi and for participating in our
        recruitment process. 
      </>,
      <>
        Recruitment was highly competitive this semester, and unfortunately, due to the 
        limited number of spots available, we are unable to invite you to continue at this time.
      </>,
      <>
        We truly appreciate your efforts and encourage you to remain involved and
        consider applying again in the future, as many of our current brothers have done.
      </>,
    ],
    nextSteps: null,
    closing: 'We wish you the best in your future endeavors. Please reach out if you have any questions.',
  },
    'bid-accept': {
    greeting: `Hello ${rusheeName}!`,
    body: [
      <>
        On behalf of Alpha Kappa Psi, we are excited to formally offer you a bid
        to join our chapter as a pledge!
      </>,
      <>
        You have demonstrated tremendous promise throughout recruitment and
        interviews, and the brotherhood has been impressed by your professionalism
        and character.
      </>,
      <>
        In order to begin the pledging process, there are several mandatory events
        that you must attend. Please review all details carefully.
      </>,
    ],
    nextSteps: [
      <>Complete the {' '}
        <button
          onClick={() => setShowBidAcceptanceModal(true)}
          className="underline text-ink hover:text-ink cursor-pointer"
        >
          Bid Acceptance Form
        </button>{' '}
        by the stated deadline</>,
      <>
        <strong>Attend Smoker:</strong> February 5th, 2026 at 6:00 PM
        <br />
        <span className="ml-4">Location: Hillel (2020 W University Ave, Gainesville, FL 32603)</span>
        <br />
        <span className="ml-4"><em>Please arrive AKPsi time (15 minutes early)</em></span>
      </>,
      <>
        <strong>Attend Inductions:</strong> February 7th, 2026 at 8:00 AM
        <br />
        <span className="ml-4">Location: TUR L005</span>
        <br />
        <span className="ml-4"><em>Be there AKPsi time (15 minutes early) and report to room 2305</em></span>
      </>,
    ],
    importantNote: (
      <>
        <strong>Important:</strong> A response to the Bid Acceptance Form is expected by{' '}
        <strong>4:00 PM on February 5th, 2026</strong>. Failure to respond by this deadline may result in your bid being rescinded.
      </>
    ),
    closing:
      'Congratulations once again. We are incredibly excited to welcome you as part of this pledge class!',
  },

    'bid-reject': {
    greeting: `Hello ${rusheeName},`,
    body: [
      <>
        Thank you for your continued interest in Alpha Kappa Psi throughout the
        recruitment process.
      </>,
      <>
        After careful deliberation, we regret to inform you that we are unable to
        extend a bid this semester due to the competitive nature of recruitment.
      </>,
      <>
        Making it this far is an accomplishment in itself, and we truly appreciate your interest
        and encourage you to reapply in the future as many current Brothers have done so.

        With that said, it has been a pleasure getting to know you.. 
      </>,
      <>
        Please feel free to reach out if you have questions or would like guidance
        moving forward.
      </>,
    ],
    nextSteps: null,
    closing: 'We sincerely wish you success in all future endeavors.',
  },
}

  const content = letterContent[type]

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto font-serif">
      {/* Letterhead */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wider text-black">ALPHA KAPPA PSI</h1>
          <p className="text-sm text-ink-muted mt-1 tracking-wide uppercase">ALPHA PHI CHAPTER</p>
        </div>
      </div>

      {/* Letter Content */}
      <div className="space-y-4 text-inverse-soft">
        <p className="font-semibold">{content.greeting}</p>

        {content.body.map((paragraph, index) => (
          <p key={index} className="leading-relaxed">
            {paragraph}
          </p>
        ))}

        {content.nextSteps && (
          <div className="mt-6">
            <p className="font-semibold mb-2">Next Steps:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              {content.nextSteps.map((step, index) => (
                <li key={index} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.importantNote && (
          <p className="mt-4 leading-relaxed">{content.importantNote}</p>
        )}

        {content.closing && (
          <p className="mt-6 leading-relaxed">{content.closing}</p>
        )}
      </div>

      {/* Signature */}
      <div className="mt-8 pt-6">
        <p className="font-semibold text-inverse-soft">
          {content.nextSteps ? 'Sincerely,' : 'Best regards,'}
        </p>
        <p className="mt-4 text-inverse-soft">{vpName}</p>
        <p className="text-sm text-ink-muted">Vice President of Alumni & External Affairs</p>
        <p className="text-sm text-ink-muted">Alpha Kappa Psi | Alpha Phi Chapter | University of Florida</p>
      </div>

      {/* Confirmation Form Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[2000px] h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-line flex-shrink-0">
              <h2 className="text-2xl font-bold text-ink">Recruitment Confirmation Form</h2>
              <div className="flex items-center gap-2">
                <a
                  href="https://tally.so/r/pbOD8y"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 hover:bg-surface-sunken rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="p-2 hover:bg-surface-sunken rounded-lg transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content - Embedded Tally Form */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="https://tally.so/r/pbOD8y"
                width="100%"
                height="100%"
                title="Recruitment Confirmation Form"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bid Acceptance Form Modal */}
      {showBidAcceptanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[2000px] h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-line flex-shrink-0">
              <h2 className="text-2xl font-bold text-ink">Bid Acceptance Form</h2>
              <div className="flex items-center gap-2">
                <a
                  href="https://tally.so/r/7RxYOA"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 hover:bg-surface-sunken rounded-lg transition-colors"
                  title="Open in new tab"
                >
                  <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <button
                  onClick={() => setShowBidAcceptanceModal(false)}
                  className="p-2 hover:bg-surface-sunken rounded-lg transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content - Embedded Tally Form */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src="https://tally.so/r/7RxYOA"
                width="100%"
                height="100%"
                title="Bid Acceptance Form"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
