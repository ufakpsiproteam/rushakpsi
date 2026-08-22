'use client'

import RusheeNav from '@/components/rushee/RusheeNav'
import StatusBanner from '@/components/rushee/StatusBanner'
import ProfilePictureModal from '@/components/rushee/ProfilePictureModal'
import PullToRefresh from '@/components/PullToRefresh'
import CalendarExportButton from '@/components/portal/CalendarExportButton'
import AddToGoogleCalendarButton from '@/components/portal/AddToGoogleCalendarButton'
import { useState, useRef, useEffect, useCallback } from 'react'
import { getEvents } from '@/lib/api'
import { getEventById, submitAttendance, getRusheeAttendance } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { Sora, DM_Sans } from 'next/font/google'
import { formatDateInEST } from '@/lib/dateUtils'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'] })
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

interface Event {
  id: string
  title: string
  type: 'Casual' | 'Professional'
  date: string
  time: string
  status: 'locked' | 'attendance' | 'evaluation'
  location?: string
  description?: string
  accepting_evals: boolean
  created_at: string
}

export default function RusheeEvents() {
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [captureStep, setCaptureStep] = useState<'instructions' | 'camera' | 'review' | 'submitted'>('instructions')
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [eventStatuses, setEventStatuses] = useState<Record<string, 'attended' | 'pending' | 'upcoming'>>({})
  const [eventGroups, setEventGroups] = useState<Record<string, number>>({})
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [faceVisible, setFaceVisible] = useState(false)
  const [onlyOneFace, setOnlyOneFace] = useState(false)
  const [assignedGroup, setAssignedGroup] = useState<number | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [rusheeData, setRusheeData] = useState<{
    casualEvents: number
    professionalEvents: number
    applicationComplete: boolean
    inviteOnly: boolean | null
    bidStatus: boolean | null
  }>({
    casualEvents: 0,
    professionalEvents: 0,
    applicationComplete: false,
    inviteOnly: null,
    bidStatus: null,
  })

  // Fetch events and attendance from Supabase
  const fetchData = useCallback(async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch events
      const eventsData = await getEvents()
      setEvents(eventsData)

      // Fetch rushee decision state
      const { data: rushee } = await supabase
        .from('rushees')
        .select('invite_only, bid_status')
        .eq('id', user.id)
        .single()

      // Fetch user's attendance records
      const { data: attendanceData } = await getRusheeAttendance(user.id)

      // Build status map from attendance records and calculate counts
      const statuses: Record<string, 'attended' | 'pending' | 'upcoming'> = {}
      const groups: Record<string, number> = {}
      let casualCount = 0
      let professionalCount = 0

      if (attendanceData) {
        attendanceData.forEach((record: any) => {
          if (record.status === 'approved') {
            statuses[record.event_id] = 'attended'
            // Store group number if available
            if (record.group_number) {
              groups[record.event_id] = record.group_number
            }
            // Count by event type
            if (record.event?.type === 'Casual') {
              casualCount++
            } else if (record.event?.type === 'Professional') {
              professionalCount++
            }
          } else if (record.status === 'pending') {
            statuses[record.event_id] = 'pending'
            // Store group number for pending as well
            if (record.group_number) {
              groups[record.event_id] = record.group_number
            }
          }
          // rejected status means no attendance
        })
      }
      setEventStatuses(statuses)
      setEventGroups(groups)

      // Check if application is complete
      const { data: application } = await supabase
        .from('applications')
        .select('is_submitted')
        .eq('rushee_id', user.id)
        .single()

      // Update rushee data with real counts
      setRusheeData({
        casualEvents: casualCount,
        professionalEvents: professionalCount,
        applicationComplete: !!(application as any)?.is_submitted,
        inviteOnly: (rushee as any)?.invite_only ?? null,
        bidStatus: (rushee as any)?.bid_status ?? null,
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Helper to get display status for an event
  const getEventDisplayStatus = (eventId: string) => {
    // Check if we have an override status from photo submission
    if (eventStatuses[eventId]) {
      return eventStatuses[eventId]
    }
    // Real attendance status is already fetched and merged into
    // eventStatuses above (see fetchData) — this only covers events with
    // no attendance record at all, which are genuinely upcoming.
    return 'upcoming' as 'attended' | 'pending' | 'upcoming'
  }

  const handleCheckIn = async (eventId: string) => {
    try {
      // Verify event status from backend before proceeding
      const { data: event, error } = await getEventById(eventId)

      if (error) {
        alert('Failed to verify event status. Please try again.')
        return
      }

      const eventData: any = event
      if (!eventData || eventData.status !== 'attendance') {
        alert('This event is no longer available for check-in. The page will refresh.')
        window.location.reload()
        return
      }

      // Status verified - proceed with check-in
      setSelectedEvent(eventId)
      setShowPhotoModal(true)
      setCaptureStep('instructions')
      setCapturedPhoto(null)
    } catch (error) {
      console.error('Error verifying event status:', error)
      alert('Failed to verify event status. Please refresh the page.')
    }
  }

  const handleStartCamera = () => {
    setCaptureStep('camera')
    setTimeout(() => {
      startCamera()
    }, 100)
  }

  const startCamera = async () => {
    try {
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }

      // Clear video element
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Get new camera stream
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      setStream(mediaStream)

      // Wait for video element to be ready
      await new Promise(resolve => setTimeout(resolve, 100))

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream

        // Wait for loadedmetadata event
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve()
            }
          } else {
            resolve()
          }
        })

        // Play the video
        try {
          await videoRef.current.play()
        } catch (playError) {
          console.error('Play error:', playError)
        }

        // Start countdown after video is playing
        setTimeout(() => {
          setCountdown(3)
        }, 500)
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions.')
    }
  }

  // Countdown and auto-capture effect
  useEffect(() => {
    if (countdown === null) return

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0) {
      capturePhoto()
    }
  }, [countdown])

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext('2d')
      if (context) {
        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert to image data
        const imageData = canvas.toDataURL('image/jpeg', 0.95)
        setCapturedPhoto(imageData)
        setCaptureStep('review')
        setCountdown(null)

        // Stop camera stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          setStream(null)
        }
      }
    }
  }

  const retakePhoto = () => {
    setCapturedPhoto(null)
    setCountdown(null)
    setFaceVisible(false)
    setOnlyOneFace(false)

    // Set to camera step first to ensure video element is rendered
    setCaptureStep('camera')

    // Start camera after a brief delay to ensure DOM is updated
    setTimeout(() => {
      startCamera()
    }, 100)
  }

  const handlePhotoSubmit = async () => {
    if (!selectedEvent || !capturedPhoto) return

    try {
      // Verify event status one more time before submission
      const { data: event, error } = await getEventById(selectedEvent)

      if (error) {
        alert('Failed to verify event status. Please try again.')
        return
      }

      const eventData: any = event
      if (!eventData || eventData.status !== 'attendance') {
        // Stop camera
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          setStream(null)
        }

        setShowPhotoModal(false)
        setCaptureStep('instructions')
        setCapturedPhoto(null)

        alert('This event is no longer available for check-in. The page will refresh.')
        window.location.reload()
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to submit attendance.')
        return
      }

      // Convert base64 to blob
      const base64Response = await fetch(capturedPhoto)
      const blob = await base64Response.blob()

      // Create a file from the blob
      const file = new File([blob], `${user.id}_${selectedEvent}_${Date.now()}.jpg`, { type: 'image/jpeg' })

      // Upload to Supabase storage
      const fileExt = 'jpg'
      const fileName = `${user.id}/${selectedEvent}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Error uploading photo:', uploadError)
        alert('Failed to upload photo. Please try again.')
        return
      }

      // 'attendance-photos' is a private bucket — store the storage path,
      // not a public URL (which 403s). Readers resolve a signed URL on
      // display via lib/resolvePhotoUrl.ts.
      const { data: attendanceData, error: attendanceError } = await submitAttendance(selectedEvent, user.id, uploadData.path)
      const isSelectBlocked =
        !!attendanceError &&
        ((attendanceError as any).code === 'PGRST116' ||
          (attendanceError.message || '').includes('Results contain 0 rows'))

      if (attendanceError && !isSelectBlocked) {
        console.error('Error creating attendance record:', attendanceError)
        alert('Failed to submit attendance. Please try again.')
        return
      }

      // Store the assigned group number
      const attendance: any = attendanceData
      if (attendance && attendance.group_number) {
        setAssignedGroup(attendance.group_number)
        // Also update the eventGroups state so it shows on the event card
        setEventGroups(prev => ({
          ...prev,
          [selectedEvent]: attendance.group_number
        }))
      }

      // Stop camera if still active
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }

      // Update event status to attended in UI (since default is approved)
      setEventStatuses(prev => ({
        ...prev,
        [selectedEvent]: 'attended'
      }))

      // Move to submitted confirmation screen
      setCaptureStep('submitted')
    } catch (error) {
      console.error('Error submitting photo:', error)
      alert('Failed to submit check-in. Please try again.')
    }
  }

  const closeModal = () => {
    // Stop camera if active
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }

    setShowPhotoModal(false)
    setCaptureStep('instructions')
    setCapturedPhoto(null)
    setCountdown(null)
    setFaceVisible(false)
    setOnlyOneFace(false)
    setAssignedGroup(null)
  }

  return (
    <div className={`${dmSans.className} min-h-screen bg-canvas text-ink`}>
      <ProfilePictureModal />
      <style jsx>{`
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.4), 0 0 40px rgba(34, 197, 94, 0.2);
          }
          50% {
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.6), 0 0 60px rgba(34, 197, 94, 0.3);
          }
        }
      `}</style>
      <RusheeNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <div className="mb-6 pt-2 lg:pt-0">
            <div className="rounded-2xl border border-line bg-white/90 px-6 py-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Rush Calendar</p>
                  <h1 className={`${sora.className} mt-3 text-3xl sm:text-4xl font-semibold text-ink`}>
                    Rushee Events
                  </h1>
                </div>
                {!loading && (
                  <CalendarExportButton
                    events={events}
                    label="Download (.ics)"
                    buttonClassName="btn btn-secondary btn-sm whitespace-nowrap"
                  />
                )}
              </div>
              <p className="mt-2 text-sm text-ink-muted max-w-2xl">
                Track requirements, check in when attendance opens, and keep your progress in one place.
              </p>
            </div>
          </div>

          {/* Status Banner */}
          <div className="mb-8">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <StatusBanner
                casualEvents={rusheeData.casualEvents}
                professionalEvents={rusheeData.professionalEvents}
                applicationComplete={rusheeData.applicationComplete}
                inviteOnly={rusheeData.inviteOnly}
                bidStatus={rusheeData.bidStatus}
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
              <p className="mt-4 text-ink-muted">Loading events...</p>
            </div>
          )}

          {/* Events Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {events.map((event) => {
                const displayStatus = getEventDisplayStatus(event.id)
                const formattedDate = formatDateInEST(event.date)

                // Check if attendance is open based on admin status
                const isAttendanceOpen = event.status === 'attendance'
                const isEvaluationOpen = event.status === 'evaluation'
                const isLocked = event.status === 'locked'

                return (
                  <div
                    key={event.id}
                    className={`rounded-2xl border bg-white p-6 shadow-sm transition ${
                      isAttendanceOpen && displayStatus === 'upcoming'
                        ? 'border-emerald-400 ring-2 ring-emerald-300/60'
                        : 'border-line hover:border-line-strong'
                    }`}
                    style={
                      isAttendanceOpen && displayStatus === 'upcoming'
                        ? {
                            boxShadow: '0 0 18px rgba(34, 197, 94, 0.25)'
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-ink-faint">
                          {event.type} Event
                        </p>
                        <h2 className={`${sora.className} mt-2 text-2xl font-semibold text-ink`}>
                          {event.title}
                        </h2>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.2em] ${
                          event.type === 'Professional'
                            ? 'bg-ink text-white'
                            : 'bg-surface-sunken text-ink-muted'
                        }`}
                      >
                        {event.type}
                      </span>
                    </div>

                    <div className="mt-4">
                      <AddToGoogleCalendarButton
                        event={event}
                        className="btn btn-secondary btn-sm btn-block"
                      />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-ink-muted">
                      <div className="flex items-center justify-between border border-line rounded-lg px-4 py-3">
                        <span className="text-xs uppercase tracking-[0.3em] text-ink-faint">Date</span>
                        <span className="font-semibold text-ink">{formattedDate}</span>
                      </div>
                      <div className="flex items-center justify-between border border-line rounded-lg px-4 py-3">
                        <span className="text-xs uppercase tracking-[0.3em] text-ink-faint">Time</span>
                        <span className="font-semibold text-ink">{event.time}</span>
                      </div>
                      <div className="flex items-center justify-between border border-line rounded-lg px-4 py-3">
                        <span className="text-xs uppercase tracking-[0.3em] text-ink-faint">Location</span>
                        <span className="font-semibold text-ink">{event.location || 'TBA'}</span>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {displayStatus === 'attended' && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-700 font-semibold">Attendance Approved</span>
                            <span className="text-xs uppercase tracking-[0.3em] text-emerald-600">Attended</span>
                          </div>
                          {eventGroups[event.id] && (
                            <div className="mt-2 border-t border-emerald-200 pt-2 text-sm text-emerald-700">
                              Assigned to Group {eventGroups[event.id]}
                            </div>
                          )}
                        </div>
                      )}

                      {displayStatus === 'pending' && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-amber-700 font-semibold">Check-In Pending</span>
                            <span className="text-xs uppercase tracking-[0.3em] text-amber-600">Reviewing</span>
                          </div>
                          {eventGroups[event.id] && (
                            <div className="mt-2 border-t border-amber-200 pt-2 text-sm text-amber-700">
                              Assigned to Group {eventGroups[event.id]}
                            </div>
                          )}
                        </div>
                      )}

                      {isAttendanceOpen && displayStatus === 'upcoming' && (
                        <button
                          onClick={() => handleCheckIn(event.id)}
                          className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
                        >
                          Check In Now
                        </button>
                      )}

                      {isEvaluationOpen && displayStatus === 'upcoming' && (
                        <div className="rounded-lg border border-line bg-surface-alt px-4 py-3">
                          <span className="text-ink-muted font-semibold">Check-In Closed</span>
                          <p className="text-sm text-ink-subtle mt-1">This event is no longer available for check-in.</p>
                        </div>
                      )}

                      {isLocked && displayStatus === 'upcoming' && (
                        <div className="rounded-lg border border-line bg-surface-alt px-4 py-3">
                          <span className="text-ink-muted font-semibold">Check-In Not Available</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {events.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <p className="text-ink-muted text-lg">No events scheduled yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Calendar Export (bulk, below list) */}
          {!loading && events.length > 0 && (
            <div className="mt-6 flex flex-col items-center text-center">
              <CalendarExportButton events={events} showNote />
            </div>
          )}

        {/* Photo Check-In Modal */}
        {showPhotoModal && (
          <div className="fixed inset-0 bg-[var(--color-inverse-soft)]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="modal-panel p-6 max-w-2xl w-full">
              <h2 className="page-title text-2xl mb-4">
                {captureStep === 'instructions' && 'Event Check-In'}
                {captureStep === 'camera' && 'Take Your Photo'}
                {captureStep === 'review' && 'Review Photo'}
                {captureStep === 'submitted' && 'Submission Complete'}
              </h2>

              {/* Progress Indicator */}
              {captureStep !== 'submitted' && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className={`h-2 w-2 rounded-full ${captureStep === 'instructions' ? 'bg-inverse w-8' : 'bg-line-strong'}`} />
                  <div className={`h-2 w-2 rounded-full ${captureStep === 'camera' ? 'bg-inverse w-8' : 'bg-line-strong'}`} />
                  <div className={`h-2 w-2 rounded-full ${captureStep === 'review' ? 'bg-inverse w-8' : 'bg-line-strong'}`} />
                </div>
              )}

              {/* Instructions Step */}
              {captureStep === 'instructions' && (
                <div>
                  <div className="bg-surface-alt border-2 border-line-strong rounded-lg p-6 mb-6">
                    <h3 className="text-ink font-semibold mb-3 text-lg">Photo Guidelines:</h3>
                    <ul className="text-sm text-ink-muted space-y-2">
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Clear photo of your face</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Well-lit environment</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>No filters or effects</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Taken at the event location</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-surface-alt border-2 border-line-strong rounded-lg p-4 mb-6">
                    <p className="text-ink text-sm font-medium">
                      📸 The photo will be taken automatically 3 seconds after the camera starts.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={closeModal} className="btn btn-secondary flex-1">
                      Cancel
                    </button>
                    <button onClick={handleStartCamera} className="btn btn-primary flex-1">
                      Start Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Step */}
              {captureStep === 'camera' && (
                <div>
                  <div className="relative bg-black rounded-lg overflow-hidden mb-4 max-h-96">
                    <video
                      ref={videoRef}
                      key="camera-video"
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto mirror max-h-96 object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                    {countdown !== null && countdown > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="text-white text-9xl font-bold animate-pulse drop-shadow-lg">
                          {countdown}
                        </div>
                      </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="bg-surface-alt border-2 border-line-strong rounded-lg p-4 mb-4">
                    <p className="text-ink-muted text-sm text-center font-medium">
                      {countdown !== null && countdown > 0
                        ? `Photo will be taken in ${countdown}...`
                        : 'Position yourself in the frame'}
                    </p>
                  </div>

                  <button onClick={closeModal} className="btn btn-secondary btn-block">
                    Cancel
                  </button>
                </div>
              )}

              {/* Review Step */}
              {captureStep === 'review' && capturedPhoto && (
                <div>
                  <div className="bg-black rounded-lg overflow-hidden mb-4 max-h-96">
                    <img
                      src={capturedPhoto}
                      alt="Captured photo"
                      className="w-full h-auto max-h-96 object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>

                  <div className="bg-surface-alt border-2 border-line-strong rounded-lg p-4 mb-4">
                    <p className="text-ink-muted text-sm font-semibold mb-3">
                      Please confirm the following before submitting:
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={faceVisible}
                          onChange={(e) => setFaceVisible(e.target.checked)}
                          className="w-5 h-5 rounded border-line-strong text-inverse focus:ring-inverse mr-3"
                        />
                        <span className="text-ink-muted text-sm">Your face is clearly seen</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyOneFace}
                          onChange={(e) => setOnlyOneFace(e.target.checked)}
                          className="w-5 h-5 rounded border-line-strong text-inverse focus:ring-inverse mr-3"
                        />
                        <span className="text-ink-muted text-sm">Your face is the only one in view</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={retakePhoto}
                      className="flex-1 py-3 bg-white text-black border-2 border-black rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                    >
                      Retake Photo
                    </button>
                    <button
                      onClick={handlePhotoSubmit}
                      disabled={!faceVisible || !onlyOneFace}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        faceVisible && onlyOneFace
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-line-strong text-ink-subtle cursor-not-allowed'
                      }`}
                    >
                      Submit Check-In
                    </button>
                  </div>
                </div>
              )}

              {/* Submitted Confirmation Step */}
              {captureStep === 'submitted' && (
                <div className="text-center py-4 pb-24 lg:py-8">
                  <div className="mb-6">
                    <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="page-title text-2xl mb-2">Check-In Submitted!</h3>
                    <p className="text-ink-muted mb-4">
                      Your attendance photo has been submitted for review.
                    </p>

                    {/* Display assigned group */}
                    {assignedGroup && (
                      <div className="bg-surface-alt border-2 border-ink rounded-lg p-4 mb-4">
                        <p className="text-ink text-sm font-semibold mb-1">
                          You have been assigned to:
                        </p>
                        <p className="text-ink text-3xl font-bold">
                          Group {assignedGroup}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-surface-alt border-2 border-line-strong rounded-lg p-4 mb-6">
                    <p className="text-ink text-sm font-medium mb-2">
                      What happens next?
                    </p>
                    <ul className="text-sm text-ink-muted space-y-1 text-left">
                      <li className="flex items-start">
                        <span className="mr-2">1.</span>
                        <span>A brother will review your photo</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">2.</span>
                        <span>Once approved, this event will be marked as attended</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">3.</span>
                        <span>You can check your status on the Events page</span>
                      </li>
                    </ul>
                  </div>

                  <button onClick={closeModal} className="btn btn-primary btn-block">
                    Done
                  </button>
                </div>
              )}

              {captureStep !== 'submitted' && (
                <p className="text-xs text-ink-muted text-center mt-4">
                  If you experience any issues, see a brother at the event for manual check-in.
                </p>
              )}
            </div>
          </div>
        )}
        </main>
      </PullToRefresh>
    </div>
  )
}
