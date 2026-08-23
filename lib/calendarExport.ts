import { createEvents, type EventAttributes } from 'ics'
import {
  CHAPTER_TIMEZONE,
  addOneDay,
  chapterInstantAtMinutes,
  formatYYYYMMDD,
  isTBDTime,
  parseCalendarDate,
  parseEventEndMinutes,
  parseEventStartMinutes,
} from '@/lib/dateUtils'

export interface CalendarExportEvent {
  id: string
  title: string
  type: 'Casual' | 'Professional'
  date: string
  time?: string | null
  location?: string | null
  description?: string | null
}

const DEFAULT_DURATION_MINUTES = 120

// Standard IANA DST rules for America/New_York (effective 2007+), expressed
// as a recurring VTIMEZONE so the file is correct in perpetuity rather than
// only for one year.
const VTIMEZONE_AMERICA_NEW_YORK = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'X-LIC-LOCATION:America/New_York',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n')

function eventDescription(event: CalendarExportEvent): string {
  const parts = [`${event.type} event`]
  if (event.description) parts.push(event.description)
  return parts.join('\n\n')
}

function wallClockParts(event: CalendarExportEvent, minutes: number): [number, number, number, number, number] | null {
  const date = parseCalendarDate(event.date)
  if (!date) return null
  return [date.year, date.month, date.day, Math.floor(minutes / 60), minutes % 60]
}

/**
 * Build a single .ics file (as text) containing one VEVENT per event, with
 * times expressed in chapter time (America/New_York) via an embedded
 * VTIMEZONE block — not raw UTC — so the file displays correctly regardless
 * of the importing device's timezone.
 */
export function buildICSFile(events: CalendarExportEvent[]): string {
  const icsEvents: EventAttributes[] = events.reduce<EventAttributes[]>((acc, event) => {
    if (isTBDTime(event.time)) {
      const date = parseCalendarDate(event.date)
      if (!date) return acc

      // A 3-element date (no hour/minute) is what the `ics` library treats
      // as an all-day event — it emits DTSTART;VALUE=DATE with no time
      // component, so calendar apps show it as a banner at the top of the
      // day rather than a midnight-to-midnight block. Passing `end` equal
      // to `start` tells the library this is a same-day all-day event, so
      // it omits DTEND entirely rather than emitting a DURATION line with
      // a malformed trailing "T" (confirmed via `duration: {days:1}`,
      // which produces "DURATION:P1DT" — not valid ISO 8601).
      const allDay: [number, number, number] = [date.year, date.month, date.day]
      acc.push({
        title: event.title,
        start: allDay,
        end: allDay,
        description: eventDescription(event),
        ...(event.location ? { location: event.location } : {}),
      })
      return acc
    }

    const startMinutes = parseEventStartMinutes(event.time) ?? 0
    const endMinutes = parseEventEndMinutes(event.time) ?? startMinutes + DEFAULT_DURATION_MINUTES

    const start = wallClockParts(event, startMinutes)
    const end = wallClockParts(event, endMinutes)
    if (!start || !end) return acc

    acc.push({
      title: event.title,
      start,
      end,
      // Floating local time — no Z, no offset. We add TZID below.
      startOutputType: 'local',
      endOutputType: 'local',
      description: eventDescription(event),
      ...(event.location ? { location: event.location } : {}),
    })
    return acc
  }, [])

  const { error, value } = createEvents(icsEvents)
  if (error || !value) {
    throw error || new Error('Failed to generate .ics file')
  }

  // Tag each VEVENT's DTSTART/DTEND with TZID before injecting VTIMEZONE —
  // the VTIMEZONE block has its own DTSTART lines (defining the DST rules)
  // that must stay bare, so they can't go through the same replace.
  const withTzid = value
    .replace(/^DTSTART:/gm, `DTSTART;TZID=${CHAPTER_TIMEZONE}:`)
    .replace(/^DTEND:/gm, `DTEND;TZID=${CHAPTER_TIMEZONE}:`)

  return withTzid.replace('CALSCALE:GREGORIAN', `CALSCALE:GREGORIAN\r\n${VTIMEZONE_AMERICA_NEW_YORK}`)
}

export function downloadICSFile(events: CalendarExportEvent[], filename = 'akpsi-rush-events.ics') {
  const content = buildICSFile(events)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toGoogleUTCString(instantMs: number): string {
  return new Date(instantMs).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Build the Google Calendar "quick add" URL for a single event. Google
 * requires UTC (Z-suffixed) timestamps, so this converts from chapter time
 * separately from the .ics TZID handling above.
 */
export function buildGoogleCalendarUrl(event: CalendarExportEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: eventDescription(event),
  })

  if (isTBDTime(event.time)) {
    // All-day events use bare YYYYMMDD dates (no time, no Z) — Google
    // treats the end date as exclusive, so a one-day all-day event's end
    // is the following calendar day.
    const date = parseCalendarDate(event.date)
    if (date) {
      params.set('dates', `${formatYYYYMMDD(date)}/${formatYYYYMMDD(addOneDay(date))}`)
    }
  } else {
    const startMinutes = parseEventStartMinutes(event.time) ?? 0
    const endMinutes = parseEventEndMinutes(event.time) ?? startMinutes + DEFAULT_DURATION_MINUTES

    const startInstant = chapterInstantAtMinutes(event.date, startMinutes)
    const endInstant = chapterInstantAtMinutes(event.date, endMinutes)

    params.set(
      'dates',
      `${startInstant ? toGoogleUTCString(startInstant) : ''}/${endInstant ? toGoogleUTCString(endInstant) : ''}`
    )
  }

  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
