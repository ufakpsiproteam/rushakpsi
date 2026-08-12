import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface VotingChannelCallbacks {
  onDiscussionStarted?: (payload: { rusheeId: string; startedAt: string }) => void
  onDiscussionExtended?: (payload: { extendedAt: string }) => void
  onVotingOpened?: (payload: { openedAt: string }) => void
  onVotingClosed?: (payload: { result: string }) => void
  onVoteSubmitted?: (payload: { voteCount: { yes: number; no: number; abstain: number } }) => void
  onNextRushee?: (payload: { rusheeId: string }) => void
  onSessionEnded?: () => void
  onPresenceUpdate?: (presenceState: any) => void
}

export function createVotingChannel(sessionId: string): RealtimeChannel {
  return supabase.channel(`voting_session:${sessionId}`, {
    config: {
      presence: {
        key: sessionId,
      },
      broadcast: {
        self: true,
      },
    },
  })
}

export function subscribeToSession(
  sessionId: string,
  callbacks: VotingChannelCallbacks
): RealtimeChannel {
  const channel = createVotingChannel(sessionId)

  // Subscribe to broadcast events
  if (callbacks.onDiscussionStarted) {
    channel.on('broadcast', { event: 'discussion_started' }, ({ payload }) => {
      callbacks.onDiscussionStarted?.(payload)
    })
  }

  if (callbacks.onDiscussionExtended) {
    channel.on('broadcast', { event: 'discussion_extended' }, ({ payload }) => {
      callbacks.onDiscussionExtended?.(payload)
    })
  }

  if (callbacks.onVotingOpened) {
    channel.on('broadcast', { event: 'voting_opened' }, ({ payload }) => {
      callbacks.onVotingOpened?.(payload)
    })
  }

  if (callbacks.onVotingClosed) {
    channel.on('broadcast', { event: 'voting_closed' }, ({ payload }) => {
      callbacks.onVotingClosed?.(payload)
    })
  }

  if (callbacks.onVoteSubmitted) {
    channel.on('broadcast', { event: 'vote_submitted' }, ({ payload }) => {
      callbacks.onVoteSubmitted?.(payload)
    })
  }

  if (callbacks.onNextRushee) {
    channel.on('broadcast', { event: 'next_rushee' }, ({ payload }) => {
      callbacks.onNextRushee?.(payload)
    })
  }

  if (callbacks.onSessionEnded) {
    channel.on('broadcast', { event: 'session_ended' }, () => {
      callbacks.onSessionEnded?.()
    })
  }

  // Subscribe to presence
  if (callbacks.onPresenceUpdate) {
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState()
      callbacks.onPresenceUpdate?.(presenceState)
    })
  }

  // Subscribe to the channel
  channel.subscribe()

  return channel
}

export async function sendControlEvent(
  channel: RealtimeChannel,
  event: string,
  payload: any
) {
  await channel.send({
    type: 'broadcast',
    event,
    payload,
  })
}

export async function trackPresence(
  channel: RealtimeChannel,
  brotherId: string,
  brotherName: string
) {
  await channel.track({
    brother_id: brotherId,
    name: brotherName,
    online_at: Date.now(),
  })
}

export async function unsubscribeChannel(channel: RealtimeChannel) {
  await channel.untrack()
  await channel.unsubscribe()
  supabase.removeChannel(channel)
}
