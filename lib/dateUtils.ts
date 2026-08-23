import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'

/**
 * Chapter time — PRD §11.3.
 *
 * "All display and all business logic use chapter time
 * (America/New_York). Every date shown to a user is rendered in chapter
 * time, including greetings, event cards, deadlines, and audit entries."
 *
 * The previous implementation composed `parseISO(dateString + 'T00:00:00')`
 * with `toZonedTime(...)`. parseISO with no offset parses in the *browser's*
 * timezone, so the resulting instant already depended on the viewer's
 * machine; re-projecting it into ET could shift the displayed date by a
 * whole day for anyone outside UTC. That is precisely the browser-local
 * failure mode §11.3 exists to prevent.
 *
 * The rules here:
 *   · A bare calendar date (YYYY-MM-DD) has no timezone. Format its parts
 *     directly — never round-trip it through a Date in local time.
 *   · A real instant is derived with fromZonedTime(), which interprets a
 *     wall-clock reading *as* chapter time and returns the correct UTC
 *     instant, handling DST.
 */

export const CHAPTER_TIMEZONE = 'America/New_York'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Split a YYYY-MM-DD string without constructing a Date. */
export function parseCalendarDate(dateString: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * The calendar date one day after the given one, handling month/year
 * rollover. Pure calendar arithmetic (via a UTC-anchored Date), not a real
 * instant — there's no timezone conversion involved, just "next day on the
 * calendar," e.g. for a Google Calendar all-day event's exclusive end date.
 */
export function addOneDay(date: { year: number; month: number; day: number }): {
  year: number
  month: number
  day: number
} {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

/** YYYYMMDD, the bare calendar-date format Google Calendar's all-day `dates` param and iCal's VALUE=DATE both use. */
export function formatYYYYMMDD(date: { year: number; month: number; day: number }): string {
  return `${date.year}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`
}

/**
 * Format a calendar date for display, e.g. "February 5, 2026".
 * Timezone-independent: the same string renders identically everywhere.
 */
export function formatDateInEST(dateString: string): string {
  if (!dateString) return 'TBA'

  const parts = parseCalendarDate(dateString)
  if (!parts) return dateString

  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`
}

/** Short form, e.g. "Feb 5". */
export function formatShortDateInEST(dateString: string): string {
  if (!dateString) return 'TBA'
  const parts = parseCalendarDate(dateString)
  if (!parts) return dateString
  return `${MONTHS[parts.month - 1].slice(0, 3)} ${parts.day}`
}

/** Weekday for a calendar date, e.g. "Thursday". Computed in chapter time. */
export function formatWeekdayInEST(dateString: string): string {
  const instant = chapterInstant(dateString)
  if (instant === null) return ''
  return formatInTimeZone(new Date(instant), CHAPTER_TIMEZONE, 'EEEE')
}

/**
 * The canonical event time format: "7:00 PM" or "7:00 PM - 9:00 PM".
 * A strict subset of what parseEventStartMinutes/parseEventEndMinutes below
 * will accept (they tolerate any 1-2 digit hour with no upper bound), so
 * anything that passes this always parses correctly downstream — this is
 * the gate that keeps malformed strings ("7-9 PM") out in the first place,
 * enforced on the admin events form and mirrored in a DB CHECK constraint
 * (see supabase/migrations/20260822_enforce_event_time_format.sql and
 * 20260823_allow_tbd_event_time.sql). "TBD" (any case) is accepted as a
 * separate, deliberate literal value — see isTBDTime — for events whose
 * time genuinely isn't set yet; it renders as an all-day entry in calendar
 * exports rather than a fake midnight time block.
 */
export const EVENT_TIME_PATTERN = /^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm)(\s*-\s*(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm))?$/

export function isTBDTime(timeString?: string | null): boolean {
  return (timeString ?? '').trim().toUpperCase() === 'TBD'
}

export function isValidEventTimeFormat(timeString: string): boolean {
  const trimmed = timeString.trim()
  return isTBDTime(trimmed) || EVENT_TIME_PATTERN.test(trimmed)
}

/**
 * Parse a time string of the shape "7:00 PM" or "7:00 PM - 9:00 PM" and
 * return minutes past midnight for the *start* time.
 *
 * Event times are stored as free text, which the PRD flags as a schema
 * problem (§6.7.3 wants real starts_at/ends_at timestamps). Until that
 * migration happens, this at least fails visibly rather than silently
 * collapsing an unparseable string to midnight.
 */
export function parseEventStartMinutes(timeString?: string | null): number | null {
  if (!timeString) return null

  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(timeString)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const isPM = match[3].toUpperCase() === 'PM'

  if (isPM && hours !== 12) hours += 12
  if (!isPM && hours === 12) hours = 0

  return hours * 60 + minutes
}

/**
 * Parse the *end* time out of a range string like "7:00 PM - 9:00 PM".
 * Returns null when there's no second time to find (single time, or
 * unparseable) so callers can fall back to a default duration.
 */
export function parseEventEndMinutes(timeString?: string | null): number | null {
  if (!timeString) return null

  const matches = [...timeString.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)]
  if (matches.length < 2) return null

  const match = matches[matches.length - 1]
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const isPM = match[3].toUpperCase() === 'PM'

  if (isPM && hours !== 12) hours += 12
  if (!isPM && hours === 12) hours = 0

  return hours * 60 + minutes
}

/**
 * The UTC instant corresponding to a chapter-time wall-clock reading.
 * Returns null when the date can't be parsed, so callers can distinguish
 * "unknown" from "midnight".
 */
export function chapterInstant(dateString: string, timeString?: string | null): number | null {
  return chapterInstantAtMinutes(dateString, parseEventStartMinutes(timeString) ?? 0)
}

/** Same as chapterInstant, but takes minutes-past-midnight directly. */
export function chapterInstantAtMinutes(dateString: string, minutes: number): number | null {
  const parts = parseCalendarDate(dateString)
  if (!parts) return null

  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')

  const wallClock = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}T${hh}:${mm}:00`

  // fromZonedTime reads the string AS chapter time and returns the real
  // instant, correctly accounting for daylight saving.
  return fromZonedTime(wallClock, CHAPTER_TIMEZONE).getTime()
}

/** Sort key for events. Unknown dates sort last. */
export function getEventTimestampEST(event: { date?: string; time?: string | null }): number {
  if (!event?.date) return Number.MAX_SAFE_INTEGER
  return chapterInstant(event.date, event.time) ?? Number.MAX_SAFE_INTEGER
}

export function formatEventDateTimeEST(dateString: string, timeString?: string) {
  return {
    date: formatDateInEST(dateString),
    time: timeString || 'TBA',
  }
}

/** "now", expressed as chapter wall-clock. */
export function chapterNow(): Date {
  return toZonedTime(new Date(), CHAPTER_TIMEZONE)
}

/**
 * PRD §6.3.2 — the dashboard greeting is computed in chapter time, not
 * browser-local time, so a rushee travelling home for the weekend still
 * sees the same greeting as everyone else at the chapter.
 */
export function chapterGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = chapterNow().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** Format any instant in chapter time, e.g. for audit entries. */
export function formatInstantInEST(value: string | number | Date, pattern = 'MMM d, yyyy h:mm a'): string {
  try {
    return formatInTimeZone(new Date(value), CHAPTER_TIMEZONE, pattern)
  } catch {
    return ''
  }
}

/** True when the given calendar date is today in chapter time. */
export function isTodayInEST(dateString: string): boolean {
  const parts = parseCalendarDate(dateString)
  if (!parts) return false
  const today = formatInTimeZone(new Date(), CHAPTER_TIMEZONE, 'yyyy-MM-dd')
  return (
    today ===
    `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  )
}
