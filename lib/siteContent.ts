/**
 * Rushing copy — admin-editable content that changes semester to semester
 * (people, links, key dates, FAQ, decision-letter text, etc).
 *
 * Mirrors the app_config / lib/policy.ts pattern: SITE_CONTENT_DEFAULTS is
 * the exact copy every page already renders today. The `site_content` DB
 * row starts as `{}` (no overrides), so until an admin edits something via
 * /admin/site-content every page renders byte-identical to before this
 * feature existed — loadSiteContent() only ever overlays fields the stored
 * row actually sets, never replaces a whole section with something blank.
 */

import { supabase } from './supabase'

export interface SiteContent {
  cycle: {
    name: string
    subheading: string
    processHeading: string
  }
  links: {
    groupMeUrl: string
    instagramUrl: string
    instagramHandle: string
    linkedinUrl: string
    nationalWebsiteUrl: string
    professionalInterviewSheetUrl: string
    casualInterviewSheetUrl: string
    bidAcceptanceFormUrl: string
  }
  dates: {
    inviteOnlyDateTime: string
    smokerDateTime: string
    smokerVenue: string
    inductionDateTime: string
    inductionVenue: string
    bidResponseDeadline: string
    applicationDeadline: string
    interviewEventDatesSummary: string
  }
  contacts: {
    pointOfContactName: string
    pointOfContactTitle: string
    pointOfContactEmail: string
    vpName: string
    privacyContactEmail: string
  }
  execBoard: { title: string; name: string }[]
  recruitmentTeam: { title: string; name: string }[]
  professionalAdvisors: { title: string; name: string }[]
  pillarsLanding: { name: string; detail: string }[]
  pillarsInfo: { name: string; description: string }[]
  faq: { question: string; answer: string }[]
  aboutChapter: {
    paragraphs: string[]
    benefits: string[]
  }
  processSteps: { step: string; title: string; subtitle: string; detail: string }[]
  landingClosing: { heading: string; body: string }
  applicationQuestions: {
    essay1: string
    essay2: string
    essay3: string
  }
  decisionLetters: {
    letterheadTitle: string
    letterheadSubtitle: string
    signatureTitle: string
    signatureFooter: string
    inviteAccept: {
      body: string[]
      nextSteps: string[]
      closing: string
    }
    inviteReject: {
      body: string[]
      closing: string
    }
    bidAccept: {
      body: string[]
      bidFormPrefix: string
      bidFormButtonLabel: string
      bidFormSuffix: string
      nextSteps: string[]
      importantNote: string
      closing: string
    }
    bidReject: {
      body: string[]
      closing: string
    }
  }
}

export const SITE_CONTENT_DEFAULTS: SiteContent = {
  cycle: {
    name: 'AKΨ Fall Rush',
    subheading: 'Find your orbit',
    processHeading: 'Liftoff in…',
  },
  links: {
    groupMeUrl: 'https://groupme.com/join_group/116593082/z1Vs4Ej3',
    instagramUrl: 'https://www.instagram.com/ufakpsi/',
    instagramHandle: '@ufakpsi',
    linkedinUrl: 'https://www.linkedin.com/company/uf-alpha-kappa-psi-alpha-phi-chapter/posts/?feedView=all',
    nationalWebsiteUrl: 'https://akpsi.org',
    professionalInterviewSheetUrl:
      'https://docs.google.com/spreadsheets/d/1n2wDxGgNxCdOsXMeARDI8x791CWhSpid-4M4dIdite0/edit?usp=sharing',
    casualInterviewSheetUrl:
      'https://docs.google.com/spreadsheets/d/1qACVVDuaxDt8jsaLxYwmipFfppjwAoFO1ijIob59vXk/edit?usp=drivesdk',
    bidAcceptanceFormUrl: 'https://docs.google.com/forms/d/1q4knQzW9xyaPxWglp_z4jyJtjZ27E2DTiLRUBl5JGmc/viewform',
  },
  dates: {
    inviteOnlyDateTime: 'September 17th, 2026 at 6:15 PM',
    smokerDateTime: 'September 24th, 2026 at 6:30 PM',
    smokerVenue: 'Hillel (2020 W University Ave, Gainesville, FL 32603)',
    inductionDateTime: 'September 27th, 2026 at 8:15 AM',
    inductionVenue: 'TBD',
    bidResponseDeadline: '4:00 PM on September 24th, 2026',
    applicationDeadline: 'September 15th, 2026 at 11:59 PM',
    interviewEventDatesSummary: 'September 24th (Smoker) and September 27th (Inductions)',
  },
  contacts: {
    pointOfContactName: 'Halle Taylor',
    pointOfContactTitle: 'VP of Alumni & External',
    pointOfContactEmail: 'vpofalumexternal.alphaphi@gmail.com',
    vpName: 'Halle Taylor',
    privacyContactEmail: 'president.alphaphi@gmail.com',
  },
  execBoard: [
    { title: 'President', name: 'Olivia Liu' },
    { title: 'Executive Vice President', name: 'Rahul Karpur' },
    { title: 'VP of Finance', name: 'Alejandro Peche' },
    { title: 'VP of Alumni & External', name: 'Halle Taylor' },
    { title: 'VP of Community Service', name: 'Pranay Singh' },
    { title: 'VP of Membership', name: 'Ethan Wilson' },
    { title: 'VP of Diversity Equity & Inclusion', name: 'Sherry Jiang' },
    { title: 'VP of Professional Activities', name: 'Adrien Alfieri' },
    { title: 'VP of Professional Development', name: 'Brother Nevins' },
    { title: 'VP of Public Relations', name: 'Lydia Zhao' },
    { title: 'VP of Social Affairs', name: 'Sebastian Wright' },
  ],
  recruitmentTeam: [
    { title: 'VP of Alumni & External', name: 'Halle Taylor' },
    { title: 'AVP of Recruitment', name: 'Greyson Payne' },
    { title: 'Director of Recruitment', name: 'Rodrigo Leal' },
    { title: 'Director of Recruitment', name: 'Braden Hoening' },
    { title: 'Director of Recruitment', name: 'Ella Hermans' },
    { title: 'Director of Recruitment', name: 'Annika Shauf' },
  ],
  professionalAdvisors: [
    { title: 'Director of Pledge Education', name: 'Brother Nasse' },
    { title: 'Director of Career Development', name: 'Brother Kloss' },
    { title: 'Director of Pledge Resources', name: 'Brother Kumar' },
    { title: 'Director of Leadership Development', name: 'Brother Hall' },
    { title: 'Director of Personal Branding', name: 'Brother Thibault' },
    { title: 'Professional Administrative Assistant', name: 'Braden Hoenig' },
    { title: 'Professional Administrative Assistant', name: 'Michelle Potenza' },
    { title: 'AVP of Logistics and Onboarding', name: 'Valeria Romero' },
    { title: 'AVP of Early Career Research', name: 'Nicholas Baez' },
  ],
  pillarsLanding: [
    { name: 'Brotherhood', detail: 'Lifelong connection and accountability.' },
    { name: 'Knowledge', detail: 'Sharpen business instincts and curiosity.' },
    { name: 'Integrity', detail: 'Do the right thing, every time.' },
    { name: 'Service', detail: 'Give back with intention and impact.' },
    { name: 'Unity', detail: 'Build together, win together.' },
  ],
  pillarsInfo: [
    {
      name: 'Brotherhood',
      description: 'Building lifelong connections and a supportive network of principled business leaders.',
    },
    {
      name: 'Knowledge',
      description: 'Pursuing academic and professional excellence through continuous learning and development.',
    },
    {
      name: 'Integrity',
      description: 'Upholding the highest ethical standards in all personal and professional endeavors.',
    },
    {
      name: 'Service',
      description: 'Giving back to our community and making a positive impact on society.',
    },
    {
      name: 'Unity',
      description: 'Embracing diversity and working together toward common goals.',
    },
  ],
  faq: [
    {
      question: 'What is Alpha Kappa Psi?',
      answer:
        'Alpha Kappa Psi is the oldest and largest professional business fraternity, founded in 1904. We focus on developing principled business leaders through our Five Pillars: Brotherhood, Knowledge, Integrity, Service, and Unity.',
    },
    {
      question: 'Who can join?',
      answer:
        'Any student at the University of Florida with an interest in business and professional development is welcome to rush, regardless of major or year.',
    },
    {
      question: 'What is the time commitment?',
      answer:
        "During rush, you'll need to attend a minimum of 1 professional event, 1 casual event, and 1 event of your choice. As a brother, expect weekly meetings and various professional and social events throughout the semester.",
    },
    {
      question: 'How much does it cost?',
      answer:
        'Membership fees include national dues, chapter dues, and event costs. Specific pricing information will be shared during rush events.',
    },
    {
      question: 'What are the rush requirements?',
      answer:
        'To be eligible to apply, you must attend at least 1 professional event, 1 casual event, and 1 event of your choice during the rush period.',
    },
  ],
  aboutChapter: {
    paragraphs: [
      "Alpha Kappa Psi is the nation's oldest and largest professional business fraternity, founded in 1904 at New York University. With over 300,000 members initiated worldwide, we continue to build principled business leaders who make a positive impact on their communities and industries.",
      'The Alpha Phi chapter at the University of Florida was established to provide students with opportunities for professional development, networking, and leadership growth. Our members come from diverse academic backgrounds, all united by a passion for business and professional excellence.',
    ],
    benefits: [
      'Professional development workshops and networking events',
      'Mentorship from alumni and industry professionals',
      'Leadership opportunities within the chapter',
      'Community service and philanthropy initiatives',
      'Social events and lifelong friendships',
      'A global network of over 300,000 brothers',
    ],
  },
  processSteps: [
    {
      step: 'Step 1',
      title: 'Pre-Rush Events',
      subtitle: 'Get to know the brothers',
      detail: 'Connect early, ask questions, and see what makes AKPsi different.',
    },
    {
      step: 'Step 2',
      title: 'Rush Events',
      subtitle: 'Showcase who you are',
      detail: 'Bring your energy to professional and casual events.',
    },
    {
      step: 'Step 3',
      title: 'Application + Interviews',
      subtitle: 'Finish strong',
      detail: 'Complete requirements and submit your application and interview.',
    },
  ],
  landingClosing: {
    heading: 'Launch yourself to the moon.',
    body: 'Every brother started exactly where you are now. Come to an event, meet the chapter, and see where it goes.',
  },
  applicationQuestions: {
    essay1: 'If your personality was a planet, what planet would you be and why?',
    essay2:
      "You're on a spaceship with five strangers for six months. What role do you think you would naturally take on within the group, and why?",
    essay3: "Tell us about something you're passionate about. What motivates you to continue pursuing it?",
  },
  decisionLetters: {
    letterheadTitle: 'ALPHA KAPPA PSI',
    letterheadSubtitle: 'ALPHA PHI CHAPTER',
    signatureTitle: 'Vice President of Alumni & External Affairs',
    signatureFooter: 'Alpha Kappa Psi | Alpha Phi Chapter | University of Florida',
    inviteAccept: {
      body: [
        'On behalf of Alpha Kappa Psi, we would like to congratulate you on being invited to Professional Interviews and our Invite-Only Event.',
        'Recruitment has been extremely competitive this semester, and you have made a strong impression on the brotherhood thus far. That being said, there is one more step before we determine whether you will be offered a bid.',
        'Attendance at the Invite-Only Event is **mandatory**, as it will be your final opportunity to make an impression prior to interviews. If you have an exam conflict, please notify us as soon as possible.',
        'The dress code for both the Invite-Only Event and Professional Interviews is **business professional**.',
      ],
      nextSteps: [
        '**Attend the Invite-Only Event:** {inviteOnlyDateTime}',
        'Sign up for interviews using the following [link]({professionalInterviewSheetUrl})',
      ],
      closing: 'Again, congratulations on making it this far in the process. We look forward to seeing you soon.',
    },
    inviteReject: {
      body: [
        'Thank you for your interest in Alpha Kappa Psi and for participating in our recruitment process.',
        'Recruitment was highly competitive this semester, and unfortunately, due to the limited number of spots available, we are unable to invite you to continue at this time.',
        'We truly appreciate your efforts and encourage you to remain involved and consider applying again in the future, as many of our current brothers have done.',
      ],
      closing: 'We wish you the best in your future endeavors. Please reach out if you have any questions.',
    },
    bidAccept: {
      body: [
        'On behalf of Alpha Kappa Psi, we are excited to formally offer you a bid to join our chapter as a pledge!',
        'You have demonstrated tremendous promise throughout recruitment and interviews, and the brotherhood has been impressed by your professionalism and character.',
        'In order to begin the pledging process, there are several mandatory events that you must attend. Please review all details carefully.',
      ],
      bidFormPrefix: 'Complete the ',
      bidFormButtonLabel: 'Bid Acceptance Form',
      bidFormSuffix: ' by the stated deadline',
      nextSteps: [
        '**Attend Smoker:** {smokerDateTime}\nLocation: {smokerVenue}\n*Please arrive AKPsi time (15 minutes early)*',
        '**Attend Inductions:** {inductionDateTime}\nLocation: {inductionVenue}\n*Be there AKPsi time (15 minutes early)*',
      ],
      importantNote:
        '**Important:** A response to the Bid Acceptance Form is expected by **{bidResponseDeadline}**. Failure to respond by this deadline may result in your bid being rescinded.',
      closing: 'Congratulations once again. We are incredibly excited to welcome you as part of this pledge class!',
    },
    bidReject: {
      body: [
        'Thank you for your continued interest in Alpha Kappa Psi throughout the recruitment process.',
        'After careful deliberation, we regret to inform you that we are unable to extend a bid this semester due to the competitive nature of recruitment.',
        'Making it this far is an accomplishment in itself, and we truly appreciate your interest and encourage you to reapply in the future as many current Brothers have done so. With that said, it has been a pleasure getting to know you..',
        'Please feel free to reach out if you have questions or would like guidance moving forward.',
      ],
      closing: 'We sincerely wish you success in all future endeavors.',
    },
  },
}

/** Mutable snapshot, replaced once loadSiteContent() resolves. */
export let SITE_CONTENT: SiteContent = SITE_CONTENT_DEFAULTS

let loadPromise: Promise<SiteContent> | null = null

/**
 * Overlays `override` onto `defaults`, key by key. A field only changes if
 * the stored row actually sets it — a partially-filled admin edit (or the
 * `{}` starting row) can never blank out copy that was never touched.
 * Arrays are replaced wholesale (not merged index-wise) when the override
 * array is non-empty, since e.g. a trimmed exec board is a real 5-person
 * list, not "5 edits over the default 11".
 */
export function deepMergeSiteContent<T>(defaults: T, override: unknown): T {
  if (override === null || override === undefined) return defaults

  if (Array.isArray(defaults)) {
    return (Array.isArray(override) && override.length > 0 ? override : defaults) as T
  }

  if (typeof defaults === 'object') {
    const result: any = { ...defaults }
    const overrideObj = override as Record<string, unknown>
    for (const key of Object.keys(defaults as object)) {
      if (key in overrideObj) {
        result[key] = deepMergeSiteContent((defaults as any)[key], overrideObj[key])
      }
    }
    return result
  }

  if (typeof defaults === 'string') {
    return (typeof override === 'string' && override.trim() !== '' ? override : defaults) as T
  }

  return (override as T) ?? defaults
}

/**
 * Read `site_content` and overlay it on the defaults. Cached for the
 * lifetime of the page — content is edited rarely and never mid-session.
 */
export function loadSiteContent(): Promise<SiteContent> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const { data } = await supabase.from('site_content').select('content').limit(1).maybeSingle()
      const stored = (data as { content?: unknown } | null)?.content
      if (!stored || typeof stored !== 'object') return SITE_CONTENT_DEFAULTS

      const merged = deepMergeSiteContent(SITE_CONTENT_DEFAULTS, stored)
      SITE_CONTENT = merged
      return merged
    } catch {
      return SITE_CONTENT_DEFAULTS
    }
  })()

  return loadPromise
}
