'use client'

import RusheeNav from '@/components/rushee/RusheeNav'
import PullToRefresh from '@/components/PullToRefresh'

export default function RusheeInfo() {
  async function handleRefresh() {
    // Info page has static content, just wait a moment
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  const pillars = [
    {
      name: 'Brotherhood',
      description: 'Building lifelong connections and a supportive network of principled business leaders.'
    },
    {
      name: 'Knowledge',
      description: 'Pursuing academic and professional excellence through continuous learning and development.'
    },
    {
      name: 'Integrity',
      description: 'Upholding the highest ethical standards in all personal and professional endeavors.'
    },
    {
      name: 'Service',
      description: 'Giving back to our community and making a positive impact on society.'
    },
    {
      name: 'Unity',
      description: 'Embracing diversity and working together toward common goals.'
    }
  ]

  const executiveBoard = [
    { title: 'President', name: 'Lizzie Myers' },
    { title: 'Executive Vice President', name: 'Justin Hall' },
    { title: 'VP of Finance', name: 'Brother Wadhwani' },
    { title: 'VP of Alumni & External', name: 'Christina Tsiboukis' },
    { title: 'VP of Community Service', name: 'Abby Kloss' },
    { title: 'VP of Membership', name: 'Owen Steege' },
    { title: 'VP of Diversity Equity & Inclusion', name: 'Camila Moreno' },
    { title: 'VP of Professional Activities', name: 'Emily Jonas' },
    { title: 'VP of Professional Development', name: 'Brother Jung' },
    { title: 'VP of Public Relations', name: 'Nico Nasse' },
    { title: 'VP of Social Affairs', name: 'Isa Goncalves' }
  ]

  const recruitmentTeam = [
    { title: 'VP of Alumni & External', name: 'Christina Tsiboukis' },
    { title: 'AVP of Recruitment', name: 'Domenick Paoli' },
    { title: 'Director of Recruitment', name: 'Kush Mirchandani' },
    { title: 'Director of Recruitment', name: 'Colby Whitty' },
    { title: 'Director of Recruitment', name: 'Colton Swain' },
    { title: 'Director of Recruitment', name: 'Jennifer Lynfatt' }
  ]

  const professionalAdvisors = [
    { title: 'Director of Pledge Education', name: 'Brother Nevins' },
    { title: 'Director of Career Development', name: 'Brother Gorewitz' },
    { title: 'Director of Pledge Resources', name: 'Brother Liu' },
    { title: 'Director of Leadership Development', name: 'Brother Starkman' },
    { title: 'Director of Personal Branding', name: 'Brother Wadhwani' },
    { title: 'Professional Administrative Assistant', name: 'Valeria Romero' },
    { title: 'Professional Administrative Assistant', name: 'Valentina Thibault' },
    { title: 'AVP of Logistics and Onboarding', name: 'Braden Doherty' },
    { title: 'AVP of Logistics and Onboarding', name: 'Laura Almeida' },
    { title: 'AVP of Professional Development', name: 'David Kraehmer' },
    { title: 'Professional Opportunities Assistants', name: 'Jenna Fang' }
  ]

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
              <p>
                Alpha Kappa Psi is the nation's oldest and largest professional business fraternity, founded in 1904 at New York University. With over 300,000 members initiated worldwide, we continue to build principled business leaders who make a positive impact on their communities and industries.
              </p>
              <p>
                The Alpha Phi chapter at the University of Florida was established to provide students with opportunities for professional development, networking, and leadership growth. Our members come from diverse academic backgrounds, all united by a passion for business and professional excellence.
              </p>

              <div className="pt-2">
                <p className="font-semibold text-ink mb-2">Member Benefits:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 ml-4">
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Professional development workshops and networking events</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Mentorship from alumni and industry professionals</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Leadership opportunities within the chapter</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Community service and philanthropy initiatives</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Social events and lifelong friendships</span>
                  </div>
                  <div className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>A global network of over 300,000 brothers</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-line">
              <div className="flex flex-wrap gap-4 text-sm">
                <a
                  href="https://akpsi.org"
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
        </main>
      </PullToRefresh>
    </div>
  )
}
