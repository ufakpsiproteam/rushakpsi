'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect } from 'react'
import { getEvents, createEvent, updateEvent, deleteEvent, updateEventStatus } from '@/lib/database'
import { formatDateInEST, isValidEventTimeFormat } from '@/lib/dateUtils'

const EVENT_TIME_FORMAT_HINT = 'Enter a time like "7:00 PM" or a range like "7:00 PM - 9:00 PM", or "TBD" if not set yet'
const EVENT_TIME_INPUT_PATTERN = '^([Tt][Bb][Dd]|(1[0-2]|[1-9]):[0-5][0-9]\\s?(AM|PM|am|pm)(\\s*-\\s*(1[0-2]|[1-9]):[0-5][0-9]\\s?(AM|PM|am|pm))?)$'

type EventStatus = 'locked' | 'attendance' | 'evaluation'

interface Event {
  id: string
  title: string
  type: 'Casual' | 'Professional'
  date: string
  time: string
  location?: string
  description?: string
  status: EventStatus
  accepting_evals: boolean
  number_of_groups: number
  created_at: string
}

export default function AdminEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{ event: Event; status: EventStatus } | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    type: 'Casual' as 'Casual' | 'Professional',
    date: '',
    time: '',
    location: '',
    description: '',
    number_of_groups: 5
  })

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    try {
      const { data, error } = await getEvents()
      if (error) throw error
      const sorted = (data || []).slice().sort((a: Event, b: Event) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return aTime - bTime
      })
      setEvents(sorted)
    } catch (error) {
      console.error('Error loading events:', error)
      setMessage({ type: 'error', text: 'Failed to load events' })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (eventId: string, status: EventStatus) => {
    try {
      const { error } = await updateEventStatus(eventId, status)
      if (error) throw error

      // Update local state
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, status } : e
      ))
      setMessage({ type: 'success', text: `Event status updated to ${status}` })
    } catch (error) {
      console.error('Error updating status:', error)
      setMessage({ type: 'error', text: 'Failed to update event status' })
    }
  }

  // Status changes are one click away from disrupting a live event
  // (locking mid-attendance-window, say), so every change is confirmed
  // before it's applied rather than firing immediately on click.
  const requestStatusChange = (event: Event, status: EventStatus) => {
    if (event.status === status) return
    setPendingStatusChange({ event, status })
  }

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return
    await handleStatusChange(pendingStatusChange.event.id, pendingStatusChange.status)
    setPendingStatusChange(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidEventTimeFormat(formData.time)) {
      setMessage({ type: 'error', text: `Invalid time format. ${EVENT_TIME_FORMAT_HINT}` })
      return
    }

    try {
      const { data, error } = await createEvent(formData)
      if (error) throw error
      if (!data) throw new Error('No data returned from createEvent')

      setEvents(prev => [...prev, data])
      setShowCreateModal(false)
      resetForm()
      setMessage({ type: 'success', text: 'Event created successfully!' })
    } catch (error) {
      console.error('Error creating event:', error)
      setMessage({ type: 'error', text: 'Failed to create event' })
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return

    if (!isValidEventTimeFormat(formData.time)) {
      setMessage({ type: 'error', text: `Invalid time format. ${EVENT_TIME_FORMAT_HINT}` })
      return
    }

    try {
      const { data, error } = await updateEvent(selectedEvent.id, formData)
      if (error) throw error
      if (!data) throw new Error('No data returned from updateEvent')

      setEvents(prev => prev.map(e =>
        e.id === selectedEvent.id ? data : e
      ))
      setShowEditModal(false)
      setSelectedEvent(null)
      resetForm()
      setMessage({ type: 'success', text: 'Event updated successfully!' })
    } catch (error) {
      console.error('Error updating event:', error)
      setMessage({ type: 'error', text: 'Failed to update event' })
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await deleteEvent(eventId)
      if (error) throw error

      setEvents(prev => prev.filter(e => e.id !== eventId))
      setMessage({ type: 'success', text: 'Event deleted successfully' })
    } catch (error) {
      console.error('Error deleting event:', error)
      setMessage({ type: 'error', text: 'Failed to delete event' })
    }
  }

  const openEditModal = (event: Event) => {
    setSelectedEvent(event)
    setFormData({
      title: event.title,
      type: event.type,
      date: event.date,
      time: event.time,
      location: event.location || '',
      description: event.description || '',
      number_of_groups: event.number_of_groups || 5
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'Casual',
      date: '',
      time: '',
      location: '',
      description: '',
      number_of_groups: 5
    })
  }

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case 'locked': return 'bg-red-100 text-red-700'
      case 'attendance': return 'bg-emerald-100 text-emerald-700'
      case 'evaluation': return 'bg-blue-100 text-blue-700'
    }
  }

  const getStatusLabel = (status: EventStatus) => {
    switch (status) {
      case 'locked': return 'Locked'
      case 'attendance': return 'Attendance Window'
      case 'evaluation': return 'Evaluation Window'
    }
  }

  const getStatusIcon = (status: EventStatus) => {
    switch (status) {
      case 'locked':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
          </svg>
        )
      case 'attendance':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'evaluation':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m4-11.5V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L17 4.5z" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AdminNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading events...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Events</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">Event Management</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Control event access for rushees and brothers.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
          >
            + Create Event
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-2xl border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex justify-between items-center">
              <span>{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-xl">✕</button>
            </div>
          </div>
        )}

        {/* Status Legend */}
        <div className="bg-white border border-line rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink mb-4">Event Status Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Locked</h3>
              <p className="text-sm text-ink-muted">
                Event is not accessible to rushees or brothers. Default state.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Attendance Window</h3>
              <p className="text-sm text-ink-muted">
                Rushees can check in with photo. Brothers cannot evaluate yet.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m4-11.5V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L17 4.5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ink mb-1">Evaluation Window</h3>
              <p className="text-sm text-ink-muted">
                Check-in closed. Brothers can now submit evaluations.
              </p>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white border border-line rounded-2xl p-6 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-ink">{event.title}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        event.type === 'Professional'
                          ? 'bg-ink text-white'
                          : 'bg-line text-ink-muted'
                      }`}
                    >
                      {event.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-ink-muted mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ink-faint">Date</p>
                      <p className="mt-1 text-sm font-medium text-ink-muted">
                        {formatDateInEST(event.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-ink-faint">Time</p>
                      <p className="mt-1 text-sm font-medium text-ink-muted">{event.time || 'TBA'}</p>
                    </div>
                    {event.location && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-ink-faint">Location</p>
                        <p className="mt-1 text-sm font-medium text-ink-muted">{event.location}</p>
                      </div>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-sm text-ink-muted mb-3">{event.description}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(event)}
                      className="px-3 py-1 text-sm bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="px-3 py-1 text-sm bg-white text-red-600 border border-red-300 rounded-lg font-semibold hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Controls — mirrors the Event Status Guide above:
                  same three icons/colors, with this event's current
                  stage highlighted. Clicking a different stage asks for
                  confirmation (requestStatusChange) rather than
                  switching immediately. */}
              <div className="border-t border-line pt-4 mt-4">
                <p className="text-sm text-ink-muted mb-3 font-semibold">Event Status</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['locked', 'attendance', 'evaluation'] as EventStatus[]).map((status) => {
                    const active = event.status === status
                    return (
                      <button
                        key={status}
                        onClick={() => requestStatusChange(event, status)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? status === 'attendance'
                              ? 'border-emerald-300 bg-emerald-50'
                              : status === 'evaluation'
                                ? 'border-blue-300 bg-blue-50'
                                : 'border-red-300 bg-red-50'
                            : 'border-line bg-white hover:bg-surface-alt'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                            active ? getStatusColor(status) : 'bg-line text-ink-muted'
                          }`}
                        >
                          {getStatusIcon(status)}
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${active ? 'text-ink' : 'text-ink-muted'}`}>
                            {getStatusLabel(status)}
                          </p>
                          {active && <p className="text-xs text-ink-subtle">Current stage</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {events.length === 0 && (
            <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm">
              <p className="text-ink-muted text-lg mb-4">No events created yet</p>
              <button
                onClick={() => {
                  resetForm()
                  setShowCreateModal(true)
                }}
                className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
              >
                Create Your First Event
              </button>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-surface-alt border border-line rounded-2xl p-4">
          <p className="text-ink-muted text-sm">
            Tip: Move events through states in order: Locked → Attendance Window (during event) → Evaluation Window (after event) → Locked (when complete)
          </p>
        </div>

        {/* Status Change Confirmation */}
        {pendingStatusChange && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${getStatusColor(pendingStatusChange.status)}`}
              >
                {getStatusIcon(pendingStatusChange.status)}
              </div>
              <h2 className="text-lg font-semibold text-ink mb-2">
                Change status to {getStatusLabel(pendingStatusChange.status)}?
              </h2>
              <p className="text-sm text-ink-muted mb-6">
                &ldquo;{pendingStatusChange.event.title}&rdquo; is currently{' '}
                <strong className="text-ink">{getStatusLabel(pendingStatusChange.event.status)}</strong>.
                {pendingStatusChange.event.status === 'attendance' && pendingStatusChange.status !== 'attendance' && (
                  <> This closes check-in — rushees who haven&apos;t checked in yet won&apos;t be able to until you switch back.</>
                )}
                {pendingStatusChange.event.status === 'evaluation' && pendingStatusChange.status !== 'evaluation' && (
                  <> This hides the evaluate option from brothers who haven&apos;t started yet — anyone already mid-evaluation can still submit.</>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingStatusChange(null)}
                  className="flex-1 px-4 py-2 bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusChange}
                  className="flex-1 px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <h2 className="text-2xl font-semibold text-ink mb-4">Create New Event</h2>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Event Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Casual' | 'Professional' })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  >
                    <option value="Casual">Casual</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">
                      Time *
                    </label>
                    <input
                      type="text"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      placeholder="7:00 PM - 9:00 PM"
                      pattern={EVENT_TIME_INPUT_PATTERN}
                      title={EVENT_TIME_FORMAT_HINT}
                      className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Number of Groups *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.number_of_groups}
                    onChange={(e) => setFormData({ ...formData, number_of_groups: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                    required
                  />
                  <p className="text-xs text-ink-subtle mt-1">
                    Rushees will be automatically distributed across this many groups (1-20)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Reitz Union Grand Ballroom"
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Event details and information..."
                    rows={3}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      resetForm()
                    }}
                    className="flex-1 py-3 bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    Create Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Event Modal */}
        {showEditModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <h2 className="text-2xl font-semibold text-ink mb-4">Edit Event</h2>

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Event Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Casual' | 'Professional' })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  >
                    <option value="Casual">Casual</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink-muted mb-2">
                      Time *
                    </label>
                    <input
                      type="text"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      placeholder="7:00 PM - 9:00 PM"
                      pattern={EVENT_TIME_INPUT_PATTERN}
                      title={EVENT_TIME_FORMAT_HINT}
                      className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Number of Groups *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.number_of_groups}
                    onChange={(e) => setFormData({ ...formData, number_of_groups: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                    required
                  />
                  <p className="text-xs text-ink-subtle mt-1">
                    Changing this will automatically redistribute all attendees evenly
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Reitz Union Grand Ballroom"
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Event details and information..."
                    rows={3}
                    className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEvent(null)
                      resetForm()
                    }}
                    className="flex-1 py-3 bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
