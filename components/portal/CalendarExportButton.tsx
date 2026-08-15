'use client'

import { downloadICSFile, type CalendarExportEvent } from '@/lib/calendarExport'

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function CalendarExportButton({
  events,
  showNote = false,
  label = 'Download Calendar (.ics)',
  buttonClassName = 'btn btn-secondary',
  className = '',
}: {
  events: CalendarExportEvent[]
  showNote?: boolean
  label?: string
  buttonClassName?: string
  className?: string
}) {
  const disabled = events.length === 0

  const handleDownload = () => {
    if (disabled) return
    try {
      downloadICSFile(events)
    } catch (error) {
      console.error('Error building calendar file:', error)
      alert('Failed to build the calendar file. Please try again.')
    }
  }

  return (
    <div className={className}>
      <button onClick={handleDownload} disabled={disabled} className={buttonClassName}>
        <CalendarIcon />
        {label}
      </button>
      {showNote && (
        <p className="mt-2 text-xs text-white">
          Downloaded a file? Apple Calendar opens it directly. For Google Calendar, go to
          Settings → Import &amp; Export and select this file.
        </p>
      )}
    </div>
  )
}
