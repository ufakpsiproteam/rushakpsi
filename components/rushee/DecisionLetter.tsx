'use client'

import { useState } from 'react'
import { useSiteContent } from '@/lib/useSiteContent'
import { fillTokens, renderMarkdownLite } from '@/lib/markdownLite'

interface DecisionLetterProps {
  type: 'invite-accept' | 'invite-reject' | 'bid-accept' | 'bid-reject'
  rusheeName: string
  vpName: string
  chapterName: string
}

export default function DecisionLetter({ type, rusheeName, vpName }: DecisionLetterProps) {
  const [showBidAcceptanceModal, setShowBidAcceptanceModal] = useState(false)
  const content = useSiteContent()
  const { decisionLetters, dates, links } = content

  const tokens: Record<string, string> = {
    inviteOnlyDateTime: dates.inviteOnlyDateTime,
    professionalInterviewSheetUrl: links.professionalInterviewSheetUrl,
    smokerDateTime: dates.smokerDateTime,
    smokerVenue: dates.smokerVenue,
    inductionDateTime: dates.inductionDateTime,
    inductionVenue: dates.inductionVenue,
    bidResponseDeadline: dates.bidResponseDeadline,
  }

  const fill = (text: string) => renderMarkdownLite(fillTokens(text, tokens))

  const letterContent: Record<
    DecisionLetterProps['type'],
    {
      greeting: string
      body: string[]
      nextSteps: string[] | null
      bidFormStep?: boolean
      importantNote?: string
      closing: string | null
    }
  > = {
    'invite-accept': {
      greeting: `Hello ${rusheeName}!`,
      body: decisionLetters.inviteAccept.body,
      nextSteps: decisionLetters.inviteAccept.nextSteps,
      closing: decisionLetters.inviteAccept.closing,
    },
    'invite-reject': {
      greeting: `Hello ${rusheeName},`,
      body: decisionLetters.inviteReject.body,
      nextSteps: null,
      closing: decisionLetters.inviteReject.closing,
    },
    'bid-accept': {
      greeting: `Hello ${rusheeName}!`,
      body: decisionLetters.bidAccept.body,
      nextSteps: decisionLetters.bidAccept.nextSteps,
      bidFormStep: true,
      importantNote: decisionLetters.bidAccept.importantNote,
      closing: decisionLetters.bidAccept.closing,
    },
    'bid-reject': {
      greeting: `Hello ${rusheeName},`,
      body: decisionLetters.bidReject.body,
      nextSteps: null,
      closing: decisionLetters.bidReject.closing,
    },
  }

  const letter = letterContent[type]

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl mx-auto font-serif">
      {/* Letterhead */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-wider text-black">{decisionLetters.letterheadTitle}</h1>
          <p className="text-sm text-ink-muted mt-1 tracking-wide uppercase">{decisionLetters.letterheadSubtitle}</p>
        </div>
      </div>

      {/* Letter Content */}
      <div className="space-y-4 text-inverse-soft">
        <p className="font-semibold">{letter.greeting}</p>

        {letter.body.map((paragraph, index) => (
          <p key={index} className="leading-relaxed">
            {fill(paragraph)}
          </p>
        ))}

        {letter.nextSteps && (
          <div className="mt-6">
            <p className="font-semibold mb-2">Next Steps:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              {letter.bidFormStep && (
                <li className="leading-relaxed">
                  {decisionLetters.bidAccept.bidFormPrefix}
                  <button
                    onClick={() => setShowBidAcceptanceModal(true)}
                    className="underline text-ink hover:text-ink cursor-pointer"
                  >
                    {decisionLetters.bidAccept.bidFormButtonLabel}
                  </button>
                  {decisionLetters.bidAccept.bidFormSuffix}
                </li>
              )}
              {letter.nextSteps.map((step, index) => (
                <li key={index} className="leading-relaxed">
                  {fill(step)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {letter.importantNote && (
          <p className="mt-4 leading-relaxed">{fill(letter.importantNote)}</p>
        )}

        {letter.closing && (
          <p className="mt-6 leading-relaxed">{letter.closing}</p>
        )}
      </div>

      {/* Signature */}
      <div className="mt-8 pt-6">
        <p className="font-semibold text-inverse-soft">
          {letter.nextSteps ? 'Sincerely,' : 'Best regards,'}
        </p>
        <p className="mt-4 text-inverse-soft">{vpName}</p>
        <p className="text-sm text-ink-muted">{decisionLetters.signatureTitle}</p>
        <p className="text-sm text-ink-muted">{decisionLetters.signatureFooter}</p>
      </div>

      {/* Bid Acceptance Form Modal */}
      {showBidAcceptanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-[2000px] h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-line flex-shrink-0">
              <h2 className="text-2xl font-bold text-ink">Bid Acceptance Form</h2>
              <div className="flex items-center gap-2">
                <a
                  href={links.bidAcceptanceFormUrl}
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

            {/* Modal Content - Embedded Form */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`${links.bidAcceptanceFormUrl}?embedded=true`}
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
