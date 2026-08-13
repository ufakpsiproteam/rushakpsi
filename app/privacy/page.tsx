import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <div className="app-shell relative overflow-hidden">
      <div className="relative px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-baseline gap-3">
            <span className="lettermark text-3xl">ΑΚΨ</span>
            <span className="page-eyebrow">Alpha Phi Chapter</span>
          </Link>

          <div className="card card-pad mt-6 sm:p-10">
            <h1 className="page-title text-3xl sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 text-ink-muted">
              Alpha Kappa Psi — Alpha Phi Chapter, University of Florida
            </p>
            <p className="mt-1 text-sm text-ink-subtle">Effective date: August 13, 2026</p>
            <p className="text-sm text-ink-subtle">Last updated: August 13, 2026</p>

            <div className="mt-8 space-y-6 text-ink-muted">
              <p>
                This Privacy Policy describes how Alpha Kappa Psi, Alpha Phi Chapter (&ldquo;we,&rdquo;
                &ldquo;us,&rdquo; &ldquo;our&rdquo;) collects, uses, and protects information through our
                recruitment platform (the &ldquo;Platform&rdquo;). By creating an account or otherwise using
                the Platform, you agree to the practices described here.
              </p>

              <p>
                This Platform is operated by the chapter and is not affiliated with or operated by the
                University of Florida.
              </p>

              <section>
                <h2 className="section-title text-lg">1. Information We Collect</h2>
                <p className="mt-3 font-medium text-ink">Information you provide to us:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Name, email address, phone number, major, minor, class year, expected graduation date, and address</li>
                  <li>
                    Your GPA, as self-reported by you. We do not access or verify this against University of
                    Florida academic records.
                  </li>
                  <li>A photo taken during event check-in and, optionally, a profile photo</li>
                  <li>Application responses, including essay answers</li>
                  <li>A resume</li>
                </ul>

                <p className="mt-4 font-medium text-ink">Information collected automatically:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Event attendance and check-in records</li>
                  <li>Account activity necessary to operate the Platform (such as login timestamps)</li>
                </ul>

                <p className="mt-4 font-medium text-ink">Information generated through the recruitment process:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Records related to the recruitment and decision-making process</li>
                </ul>
              </section>

              <section>
                <h2 className="section-title text-lg">2. How We Use Your Information</h2>
                <p className="mt-3">We use the information we collect to:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>Operate and administer the recruitment process</li>
                  <li>Verify event attendance and eligibility</li>
                  <li>Evaluate applicants in a consistent and structured way</li>
                  <li>Communicate with you about your status, upcoming events, and decisions</li>
                  <li>Maintain internal records for chapter administration and accountability</li>
                </ul>
              </section>

              <section>
                <h2 className="section-title text-lg">3. How We Share Your Information</h2>
                <p className="mt-3">We do not sell your information.</p>
                <p className="mt-3">We may share information with:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  <li>
                    <span className="font-medium text-ink">Members of the chapter</span>, on a need-to-know
                    basis appropriate to their role in the recruitment process
                  </li>
                  <li>
                    <span className="font-medium text-ink">Service providers</span> who help us operate the
                    Platform, such as hosting and infrastructure providers, subject to obligations to protect
                    your information and use it only to provide services to us
                  </li>
                  <li>
                    <span className="font-medium text-ink">Authorities</span>, if required by law or to
                    protect the safety of our members or the public
                  </li>
                </ul>
                <p className="mt-4">
                  Access to your information within the Platform is restricted based on role. Prospective
                  members can see only their own information. General members see limited information about
                  prospective members relevant to recruitment. Full access to evaluations, applications, and
                  decisions is limited to chapter leadership involved in the recruitment process.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">4. Check-In Photos</h2>
                <p className="mt-3">
                  Photos taken at event check-in are used to confirm attendance and help members recognize
                  prospective members. They are reviewed by chapter members, not by facial recognition or any
                  other automated biometric process, and are not used for automated or algorithmic
                  decision-making.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">5. Data Retention</h2>
                <p className="mt-3">
                  We retain information collected during a recruitment cycle for the duration of that cycle
                  and for a period afterward for administrative purposes. As a general practice, identifying
                  recruitment-related data, including check-in photos, resumes, and application answers, is
                  deleted by the end of the semester in which the cycle occurred.
                </p>
                <p className="mt-3">
                  After that point, we may retain limited, de-identified records, such as aggregate statistics
                  or decision history that no longer identifies an individual, for internal chapter
                  accountability and historical record-keeping.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">6. Data Security</h2>
                <p className="mt-3">
                  We take reasonable measures to protect your information, including restricting access based
                  on role, using authentication to control account access, and storing files in a manner that
                  prevents public access. No method of storage or transmission is completely secure, and we
                  cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">7. Data Breach Notification</h2>
                <p className="mt-3">
                  If we become aware of a breach of security involving your personal information, we will
                  notify affected individuals without unreasonable delay, consistent with applicable Florida
                  law, and will describe the nature of the incident and the steps we are taking in response.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">8. Your Rights</h2>
                <p className="mt-3">
                  You may request a copy of the information we hold about you, ask us to correct inaccurate
                  information, or ask questions about how your information is used. Some information may be
                  retained in a limited, de-identified form after a request for administrative and
                  accountability purposes, as described in Section 5.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">9. Children&rsquo;s Privacy</h2>
                <p className="mt-3">
                  The Platform is intended for use by University of Florida students participating in
                  recruitment and is not directed at individuals under the age of 18.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">10. Changes to This Policy</h2>
                <p className="mt-3">
                  We may update this Privacy Policy from time to time. If we make material changes, we will
                  update the &ldquo;Last updated&rdquo; date above.
                </p>
              </section>

              <section>
                <h2 className="section-title text-lg">11. Contact Us</h2>
                <p className="mt-3">
                  If you have questions about this Privacy Policy or how your information is handled, contact
                  us at:
                </p>
                <p className="mt-2 font-medium text-ink">president.alphaphi@gmail.com</p>
              </section>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/" className="text-sm text-ink-subtle hover:text-ink-muted">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
