'use client'

import RusheeNav from '@/components/rushee/RusheeNav'
import PullToRefresh from '@/components/PullToRefresh'
import { useSiteContent } from '@/lib/useSiteContent'

export default function RusheeInfo() {
  const siteContent = useSiteContent()
  const pillars = siteContent.pillarsInfo
  const executiveBoard = siteContent.execBoard
  const recruitmentTeam = siteContent.recruitmentTeam
  const professionalAdvisors = siteContent.professionalAdvisors
  const aboutChapter = siteContent.aboutChapter
  const POINT_OF_CONTACT = {
    name: siteContent.contacts.pointOfContactName,
    title: siteContent.contacts.pointOfContactTitle,
    email: siteContent.contacts.pointOfContactEmail,
  }
  const nationalWebsiteUrl = siteContent.links.nationalWebsiteUrl

  async function handleRefresh() {
    // Info page has static content, just wait a moment
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return (
    <div className="min-h-screen bg-canvas">
      <RusheeNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
        <div className="mb-8 pt-2 lg:pt-0">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Chapter Information</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">About Alpha Kappa Psi</h1>
          <p className="mt-2 text-sm text-ink-muted max-w-2xl">
            Get to know our pillars, leadership, and the resources available during rush.
          </p>
        </div>

        {/* Five Pillars */}
        <section className="mb-8">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Our Five Pillars</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {pillars.map((pillar) => (
                <div
                  key={pillar.name}
                  className="bg-surface-alt border border-line rounded-xl p-4 text-center"
                >
                  <h3 className="font-semibold text-ink mb-2">{pillar.name}</h3>
                  <p className="text-ink-muted text-xs leading-tight">{pillar.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Executive Board */}
        <div className="mb-6">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Executive Board</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {executiveBoard.map((member) => (
                <div
                  key={`${member.title}-${member.name}`}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-line last:border-0 gap-1"
                >
                  <span className="font-semibold text-ink text-sm">{member.title}</span>
                  <span className="text-ink-muted text-sm sm:text-right">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Recruitment Team */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Recruitment Team</h2>
            <div className="space-y-2">
              {recruitmentTeam.map((member) => (
                <div
                  key={`${member.title}-${member.name}`}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-line last:border-0 gap-1"
                >
                  <span className="font-semibold text-ink text-sm">{member.title}</span>
                  <span className="text-ink-muted text-sm sm:text-right">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Professional Advisors */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Professional Team</h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {professionalAdvisors.map((member) => (
                <div
                  key={`${member.title}-${member.name}`}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-line last:border-0 gap-1"
                >
                  <span className="font-semibold text-ink text-sm">{member.title}</span>
                  <span className="text-ink-muted text-sm sm:text-right">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* About AKPsi */}
        <section>
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-3">About Our Chapter</h2>
            <div className="space-y-3 text-ink-muted text-sm">
              {aboutChapter.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}

              <div className="pt-2">
                <p className="font-semibold text-ink mb-2">Member Benefits:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 ml-4">
                  {aboutChapter.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex flex-wrap gap-4 text-sm">
                <a
                  href={nationalWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:text-ink-muted font-semibold underline"
                >
                  National Website
                </a>
                <a
                  href="/rushee/events"
                  className="text-ink hover:text-ink-muted font-semibold underline"
                >
                  Recruitment Events
                </a>
                <a
                  href="/rushee/dashboard"
                  className="text-ink hover:text-ink-muted font-semibold underline"
                >
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Point of Contact */}
        <section className="mt-8">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Point of Contact</h2>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-surface-sunken flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-ink">{POINT_OF_CONTACT.name}</p>
                <p className="text-ink-muted text-sm">{POINT_OF_CONTACT.title}</p>
                <a
                  href={`mailto:${POINT_OF_CONTACT.email}`}
                  className="text-ink hover:text-ink-muted text-sm font-semibold underline"
                >
                  {POINT_OF_CONTACT.email}
                </a>
              </div>
            </div>
            <p className="text-ink-subtle text-xs mt-4">
              Have any questions during recruitment? Reach out any time.
            </p>
          </div>
        </section>
        </main>
      </PullToRefresh>
    </div>
  )
}
