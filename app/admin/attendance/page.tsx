'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect } from 'react'
import { getEvents, getAttendanceForEvent, updateAttendanceStatus, createManualAttendance } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import RusheePhoto from '@/components/RusheePhoto'

interface Event {
  id: string
  title: string
  type: 'Casual' | 'Professional'
  date: string
  time: string
  status: string
  number_of_groups: number
}

interface AttendanceRecord {
  id: string
  rushee_id: string
  event_id: string
  photo_url: string
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  created_at: string
  group_number?: number
  rushee: {
    id: string
    name: string
  }
}

export default function AdminAttendance() {
  const { profile } = useAuth()
  const canManuallyAdd = profile?.access_level === 'admin' || profile?.access_level === 'recruitment'
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [allAttendanceRecords, setAllAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'removed'>('all')
  const [groupCountInput, setGroupCountInput] = useState<number | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [groupFilter, setGroupFilter] = useState<number | null>(null)

  // Manual add modal state
  const [showManualAddModal, setShowManualAddModal] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedRushee, setSelectedRushee] = useState<any | null>(null)
  const [rusheeSearchQuery, setRusheeSearchQuery] = useState('')

  // Fetch events and all attendance records on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUser(user.id)
        }

        const { data } = await getEvents()
        if (data) {
          setEvents(data)
        }

        // Fetch all attendance records for count calculation
        const { data: allAttendance } = await supabase
          .from('event_attendance')
          .select(`
            *,
            rushee:rushees!rushee_id(id, name)
          `)
          .order('created_at', { ascending: false })

        if (allAttendance) {
          setAllAttendanceRecords(allAttendance as AttendanceRecord[])
        }
      } catch (error) {
        console.error('Error fetching events:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch attendance when event is selected
  useEffect(() => {
    async function fetchAttendance() {
      if (!selectedEvent) return

      try {
        const { data } = await getAttendanceForEvent(selectedEvent)
        if (data) {
          setAttendanceRecords(data as AttendanceRecord[])
        }
      } catch (error) {
        console.error('Error fetching attendance:', error)
      }
    }

    setGroupCountInput('')
    fetchAttendance()
  }, [selectedEvent])

  const handleApprove = async (recordId: string) => {
    if (!currentUser) return

    try {
      const { error } = await updateAttendanceStatus(recordId, 'approved')
      if (error) throw error

      // Update local state
      setAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'approved' }
            : record
        )
      )
      setAllAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'approved' }
            : record
        )
      )

      // Close modal if open
      if (photoModal) {
        setPhotoModal(null)
        setSelectedRecord(null)
      }
    } catch (error) {
      console.error('Error approving attendance:', error)
      alert('Failed to approve attendance')
    }
  }

  const handleReject = async (recordId: string) => {
    if (!currentUser) return

    try {
      const { error } = await updateAttendanceStatus(recordId, 'rejected')
      if (error) throw error

      // Update local state
      setAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'rejected' }
            : record
        )
      )
      setAllAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'rejected' }
            : record
        )
      )

      // Close modal if open
      if (photoModal) {
        setPhotoModal(null)
        setSelectedRecord(null)
      }
    } catch (error) {
      console.error('Error rejecting attendance:', error)
      alert('Failed to reject attendance')
    }
  }

  const handleRemove = async (recordId: string) => {
    if (!currentUser) return
    if (!confirm('Remove this rushee\'s attendance for this event?')) return

    try {
      const { error } = await updateAttendanceStatus(recordId, 'removed')
      if (error) throw error

      // Update local state
      setAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'removed' }
            : record
        )
      )
      setAllAttendanceRecords(prev =>
        prev.map(record =>
          record.id === recordId
            ? { ...record, status: 'removed' }
            : record
        )
      )

      if (photoModal) {
        setPhotoModal(null)
        setSelectedRecord(null)
      }
    } catch (error) {
      console.error('Error removing attendance:', error)
      alert('Failed to remove attendance')
    }
  }

  // Manual add handlers
  const handleManualAdd = () => {
    setShowManualAddModal(true)
    setSearchResults([])
    setSelectedRushee(null)
    setRusheeSearchQuery('')
  }

  const handleSearchRushees = async (query: string) => {
    setRusheeSearchQuery(query)

    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    try {
      // Query from rushees table
      const { data: rusheesData, error } = await supabase
        .from('rushees')
        .select('id, name, email')
        .ilike('name', `%${query}%`)
        .limit(10)


      if (error) {
        console.error('Supabase error:', error)
        return
      }

      // Transform data to match expected format
      const transformedData = (rusheesData || []).map((rushee: any) => ({
        id: rushee.id,
        profile: {
          full_name: rushee.name,
          email: rushee.email
        }
      }))

      setSearchResults(transformedData)
    } catch (err) {
      console.error('Error searching rushees:', err)
    }
  }

  const handleManuallyAddAttendance = async () => {
    if (!selectedRushee || !selectedEvent || !canManuallyAdd) return

    try {
      const { error } = await createManualAttendance(selectedEvent, selectedRushee.id)

      if (error) throw error

      // Reload attendance records
      const { data } = await getAttendanceForEvent(selectedEvent)
      if (data) {
        setAttendanceRecords(data as AttendanceRecord[])
      }

      // Close modal and reset
      setShowManualAddModal(false)
      setSelectedRushee(null)
      alert('Attendance added successfully!')
    } catch (error: any) {
      console.error('Error adding manual attendance:', error)
      alert(error?.message || 'Failed to add attendance')
    }
  }

  const closeManualAddModal = () => {
    setShowManualAddModal(false)
    setSelectedRushee(null)
    setRusheeSearchQuery('')
    setSearchResults([])
  }

  const handleRefreshGroups = async () => {
    if (!selectedEvent) return

    if (!confirm('This will redistribute all attendees evenly across groups. Continue?')) {
      return
    }

    try {
      const { refreshEventGroups } = await import('@/lib/database')
      const { error } = await refreshEventGroups(selectedEvent)

      if (error) throw error

      // Reload attendance records
      const { data } = await getAttendanceForEvent(selectedEvent)
      if (data) {
        const formattedData = data.map((record: any) => ({
          id: record.id,
          rushee_id: record.rushee_id,
          event_id: record.event_id,
          photo_url: record.photo_url,
          status: record.status,
          created_at: record.created_at,
          group_number: record.group_number,
          rushee: {
            id: record.rushee?.id || '',
            name: record.rushee?.name || record.rushee?.profile?.full_name || 'Unknown'
          }
        }))
        setAttendanceRecords(formattedData)
      }

      alert('Groups have been refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing groups:', error)
      alert('Failed to refresh groups')
    }
  }

  const handleChangeGroupCount = async () => {
    if (!selectedEvent || groupCountInput === '') return

    if (!confirm(`Change to ${groupCountInput} groups and redistribute all attendees? Every rushee's group number will be reassigned.`)) {
      return
    }

    try {
      const { setEventGroupCount } = await import('@/lib/database')
      const { error } = await setEventGroupCount(selectedEvent, Number(groupCountInput))

      if (error) throw error

      // Reflect the new count on the selected event and reload attendance records
      setEvents(prev =>
        prev.map(event =>
          event.id === selectedEvent
            ? { ...event, number_of_groups: Number(groupCountInput) }
            : event
        )
      )

      const { data } = await getAttendanceForEvent(selectedEvent)
      if (data) {
        setAttendanceRecords(data as AttendanceRecord[])
      }

      setGroupCountInput('')
      alert('Group count updated and attendees redistributed!')
    } catch (error) {
      console.error('Error changing group count:', error)
      alert('Failed to change group count')
    }
  }

  const selectedEventData = events.find(e => e.id === selectedEvent)

  // Calculate counts using all attendance records
  const eventCounts = events.map(event => {
    const records = allAttendanceRecords.filter(r => r.event_id === event.id)
    return {
      ...event,
      attendees: records.filter(r => r.status === 'approved').length,
      pending: records.filter(r => r.status === 'pending').length
    }
  })

  // Filter attendance records by status, group, and search query
  const filteredRecords = attendanceRecords.filter(record => {
    // Filter by status
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pending' && record.status === 'pending') ||
      (filter === 'approved' && record.status === 'approved') ||
      (filter === 'removed' && record.status === 'removed')

    // Filter by group
    const matchesGroup = groupFilter === null || record.group_number === groupFilter

    // Filter by search query
    const rusheeName = record.rushee?.name || ''
    const matchesSearch = rusheeName.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesFilter && matchesGroup && matchesSearch
  })

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Attendance</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Attendance Management</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Review check-ins, approve photos, and manage event groups.
          </p>
        </div>

        {/* Events List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            <div className="col-span-4 text-center text-ink-muted">Loading events...</div>
          ) : eventCounts.length === 0 ? (
            <div className="col-span-4 text-center text-ink-muted">No events found</div>
          ) : (
            eventCounts.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border shadow-sm ${
                  selectedEvent === event.id
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white border-line hover:border-line-strong hover:-translate-y-0.5'
                }`}
              >
                <h3 className={`font-semibold mb-1 ${selectedEvent === event.id ? 'text-white' : 'text-ink'}`}>
                  {event.title}
                </h3>
                <p className={`text-sm mb-3 ${selectedEvent === event.id ? 'text-white/70' : 'text-ink-muted'}`}>
                  {new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className={selectedEvent === event.id ? 'text-white' : 'text-ink-muted'}>
                    {event.attendees} attended
                  </span>
                  {event.pending > 0 && (
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      selectedEvent === event.id
                        ? 'bg-white/90 text-ink-muted'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {event.pending} pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Attendance Details */}
        {selectedEvent && selectedEventData && (
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-ink mb-1">{selectedEventData.title}</h2>
                <p className="text-sm text-ink-muted">{selectedEventData.date}</p>
              </div>
              <div className="flex gap-3">
                {canManuallyAdd && (
                  <button
                    onClick={handleManualAdd}
                    className="px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    + Manual Add
                  </button>
                )}
                <button
                  onClick={handleRefreshGroups}
                  className="px-4 py-2 bg-line text-ink rounded-lg font-semibold hover:bg-line-strong transition-colors"
                >
                  Refresh Groups
                </button>
              </div>
            </div>

            {/* Group Distribution Info */}
            {selectedEventData && selectedEventData.number_of_groups && (
              <div className="bg-surface-alt border border-line rounded-2xl p-4 mb-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-ink text-sm font-semibold mb-1">
                      Group Configuration
                    </p>
                    <p className="text-inverse-soft text-sm">
                      {selectedEventData.number_of_groups} groups configured for this event
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ink text-sm font-semibold mb-1">
                      Distribution
                    </p>
                    <p className="text-inverse-soft text-sm">
                      ~{Math.ceil(attendanceRecords.filter(r => r.status === 'pending' || r.status === 'approved').length / selectedEventData.number_of_groups)} attendees per group
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="group-count-input" className="text-ink text-sm font-semibold">
                      Change to
                    </label>
                    <input
                      id="group-count-input"
                      type="number"
                      min={1}
                      max={20}
                      placeholder={String(selectedEventData.number_of_groups)}
                      value={groupCountInput}
                      onChange={(e) => setGroupCountInput(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-20 px-2 py-1 bg-white border border-line rounded-lg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink"
                    />
                    <button
                      onClick={handleChangeGroupCount}
                      disabled={groupCountInput === '' || groupCountInput === selectedEventData.number_of_groups}
                      className="px-3 py-1 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-inverse-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Update &amp; Redistribute
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by rushee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-white border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-faint"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                  >
                    x
                  </button>
                )}
              </div>
            </div>

            {/* Status Filters */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-ink mb-2">Filter by Status:</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                    filter === 'all'
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white border-line text-ink-muted hover:bg-surface-alt'
                  }`}
                >
                  All ({attendanceRecords.length})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                    filter === 'pending'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  Pending ({attendanceRecords.filter(r => r.status === 'pending').length})
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                    filter === 'approved'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200'
                  }`}
                >
                  Approved ({attendanceRecords.filter(r => r.status === 'approved').length})
                </button>
                <button
                  onClick={() => setFilter('removed')}
                  className={`px-4 py-2 border rounded-lg text-sm transition-colors ${
                    filter === 'removed'
                      ? 'bg-ink text-white border-ink'
                      : 'bg-surface-alt border-line text-ink-muted hover:bg-surface-sunken'
                  }`}
                >
                  Removed ({attendanceRecords.filter(r => r.status === 'removed').length})
                </button>
              </div>
            </div>

            {/* Group Filters */}
            {selectedEventData && selectedEventData.number_of_groups && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-ink mb-2">Filter by Group:</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setGroupFilter(null)}
                    className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                      groupFilter === null
                        ? 'bg-ink text-white border-ink'
                        : 'bg-white border-line text-ink-muted hover:bg-surface-alt'
                    }`}
                  >
                    All Groups
                  </button>
                  {Array.from({ length: selectedEventData.number_of_groups }, (_, i) => i + 1).map(groupNum => (
                    <button
                      key={groupNum}
                      onClick={() => setGroupFilter(groupNum)}
                      className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                        groupFilter === groupNum
                          ? 'bg-ink text-white border-ink'
                          : 'bg-surface-alt border-line text-ink hover:bg-surface-sunken'
                      }`}
                    >
                      Group {groupNum}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attendance Records */}
            <div className="space-y-3">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-ink-muted">
                  No attendance records found
                </div>
              ) : (
                filteredRecords.map((record) => {
                  const rusheeName = record.rushee?.name || 'Unknown Rushee'
                  const submittedAt = new Date(record.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })

                  return (
                    <div
                      key={record.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border ${
                        record.status === 'pending'
                          ? 'bg-amber-50 border-amber-200'
                          : record.status === 'approved'
                          ? 'bg-emerald-50 border-emerald-200'
                          : record.status === 'removed'
                          ? 'bg-surface-alt border-line'
                          : 'bg-rose-50 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className="w-12 h-12 mr-3 bg-surface-sunken rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => {
                            setPhotoModal(record.photo_url)
                            setSelectedRecord(record)
                          }}
                        >
                          <RusheePhoto
                            photo={record.photo_url}
                            bucket="attendance-photos"
                            alt={rusheeName}
                            className="w-full h-full object-cover"
                            fallback={<span className="text-ink-faint text-lg">No photo</span>}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-ink font-semibold">{rusheeName}</p>
                            {record.group_number && (
                              <span className="px-2 py-1 bg-surface-sunken text-ink text-xs font-semibold rounded-full">
                                Group {record.group_number}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-ink-muted">Submitted at {submittedAt}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {record.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => {
                                setPhotoModal(record.photo_url)
                                setSelectedRecord(record)
                              }}
                              className="px-3 py-1 bg-white text-ink border border-line-strong rounded-lg text-sm font-semibold hover:bg-surface-alt transition-colors"
                            >
                              View Photo
                            </button>
                            <button
                              onClick={() => handleApprove(record.id)}
                              className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(record.id)}
                              className="px-3 py-1 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : record.status === 'approved' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-700 text-sm font-semibold">Approved</span>
                            <button
                              onClick={() => handleRemove(record.id)}
                              className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-200 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ) : record.status === 'removed' ? (
                          <span className="text-ink-muted text-sm font-semibold">Removed</span>
                        ) : (
                          <span className="text-rose-700 text-sm font-semibold">Rejected</span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {!selectedEvent && (
          <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm">
            <p className="text-ink-muted">Select an event above to view and manage attendance</p>
          </div>
        )}

        {/* Photo Modal */}
        {photoModal && selectedRecord && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => {
              setPhotoModal(null)
              setSelectedRecord(null)
            }}
          >
            <div
              className="bg-white border border-line rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-ink">Attendance Photo</h3>
                  <p className="text-sm text-ink-muted mt-1">
                    {selectedRecord.rushee?.name || 'Unknown Rushee'} •
                    {new Date(selectedRecord.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPhotoModal(null)
                    setSelectedRecord(null)
                  }}
                  className="text-ink-muted hover:text-ink text-2xl"
                >
                  x
                </button>
              </div>

              <RusheePhoto
                photo={photoModal}
                bucket="attendance-photos"
                alt="Attendance verification"
                className="w-full h-auto rounded-2xl mb-4"
                fallback={<p className="text-ink-muted mb-4">Photo unavailable</p>}
              />

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-line">
                <div>
                  {selectedRecord.status === 'approved' && (
                    <span className="text-emerald-700 font-semibold">Approved</span>
                  )}
                  {selectedRecord.status === 'pending' && (
                    <span className="text-amber-700 font-semibold">Pending Review</span>
                  )}
                  {selectedRecord.status === 'rejected' && (
                    <span className="text-rose-700 font-semibold">Rejected</span>
                  )}
                  {selectedRecord.status === 'removed' && (
                    <span className="text-ink-muted font-semibold">Removed</span>
                  )}
                </div>

                <div className="flex gap-3">
                  {selectedRecord.status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(selectedRecord.id)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {selectedRecord.status !== 'rejected' && (
                    <button
                      onClick={() => handleReject(selectedRecord.id)}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Add Modal */}
        {showManualAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-semibold text-ink mb-4">Manual Check-In</h2>

              {/* Search input */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-black mb-2">
                  Search Rushee
                </label>
                <input
                  type="text"
                  placeholder="Type name to search..."
                  value={rusheeSearchQuery}
                  onChange={(e) => handleSearchRushees(e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink"
                  autoFocus
                />
              </div>

              {/* Search results */}
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {rusheeSearchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-ink-subtle text-sm py-4">
                    No rushees found
                  </p>
                )}
                {searchResults.map(rushee => (
                  <div
                    key={rushee.id}
                    onClick={() => setSelectedRushee(rushee)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedRushee?.id === rushee.id
                        ? 'bg-ink text-white border-ink'
                        : 'bg-white border-line hover:border-line-strong'
                    }`}
                  >
                    <p className={`font-semibold ${selectedRushee?.id === rushee.id ? 'text-white' : 'text-ink'}`}>
                      {rushee.profile?.full_name || 'Unknown'}
                    </p>
                    <p className={`text-sm ${selectedRushee?.id === rushee.id ? 'text-white/70' : 'text-ink-muted'}`}>
                      {rushee.profile?.email || 'No email'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Action button */}
              {selectedRushee && (
                <div className="mb-3">
                  <button
                    onClick={handleManuallyAddAttendance}
                    className="w-full py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    Add Attendance
                  </button>
                </div>
              )}

              <button
                onClick={closeManualAddModal}
                className="w-full py-2 border border-line rounded-lg font-semibold hover:bg-surface-alt transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
