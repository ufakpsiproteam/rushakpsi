export type Database = {
  public: {
    Tables: {
      brothers: {
        Row: {
          id: string
          email: string
          name: string
          access_level: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          access_level?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          access_level?: string | null
          created_at?: string
        }
      }
      rushees: {
        Row: {
          id: string
          name: string
          email: string
          major: string
          year: string
          photo: string
          invite_only: boolean | null
          bid_status: boolean | null
          invite_only_published_at: string | null
          invite_only_published_by: string | null
          bid_status_published_at: string | null
          bid_status_published_by: string | null
          gpa: number | null
          created_at: string
          professional_interview_score: number | null
          professional_interview_comment: string | null
          professional_option_score: number | null
          casual_interview_score: number | null
          casual_interview_comment: string | null
          ai_summary: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          major: string
          year: string
          photo?: string
          invite_only?: boolean | null
          bid_status?: boolean | null
          invite_only_published_at?: string | null
          invite_only_published_by?: string | null
          bid_status_published_at?: string | null
          bid_status_published_by?: string | null
          gpa?: number | null
          created_at?: string
          professional_interview_score?: number | null
          professional_interview_comment?: string | null
          professional_option_score?: number | null
          casual_interview_score?: number | null
          casual_interview_comment?: string | null
          ai_summary?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          major?: string
          year?: string
          photo?: string
          invite_only?: boolean | null
          bid_status?: boolean | null
          invite_only_published_at?: string | null
          invite_only_published_by?: string | null
          bid_status_published_at?: string | null
          bid_status_published_by?: string | null
          gpa?: number | null
          created_at?: string
          professional_interview_score?: number | null
          professional_interview_comment?: string | null
          professional_option_score?: number | null
          casual_interview_score?: number | null
          casual_interview_comment?: string | null
          ai_summary?: string | null
        }
      }
      events: {
        Row: {
          id: string
          title: string
          type: 'Casual' | 'Professional'
          date: string
          time: string
          accepting_evals: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          type: 'Casual' | 'Professional'
          date: string
          time: string
          accepting_evals?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          type?: 'Casual' | 'Professional'
          date?: string
          time?: string
          accepting_evals?: boolean
          created_at?: string
        }
      }
      event_attendance: {
        Row: {
          id: string
          event_id: string
          rushee_id: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          rushee_id: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          rushee_id?: string
          created_at?: string
        }
      }
      evaluations: {
        Row: {
          id: string
          brother_id: string
          rushee_id: string
          event_id: string | null
          professional_score: number
          personal_score: number
          knows_personally: boolean
          qualities: string[]
          comments: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brother_id: string
          rushee_id: string
          event_id?: string | null
          professional_score: number
          personal_score: number
          knows_personally?: boolean
          qualities?: string[]
          comments?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brother_id?: string
          rushee_id?: string
          event_id?: string | null
          professional_score?: number
          personal_score?: number
          knows_personally?: boolean
          qualities?: string[]
          comments?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      starred_rushees: {
        Row: {
          id: string
          brother_id: string
          rushee_id: string
          created_at: string
        }
        Insert: {
          id?: string
          brother_id: string
          rushee_id: string
          created_at?: string
        }
        Update: {
          id?: string
          brother_id?: string
          rushee_id?: string
          created_at?: string
        }
      }
      personal_notes: {
        Row: {
          id: string
          brother_id: string
          rushee_id: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brother_id: string
          rushee_id: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brother_id?: string
          rushee_id?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      voting_sessions: {
        Row: {
          id: string
          created_at: string
          created_by: string | null
          status: string | null
          current_rushee_id: string | null
          eligible_voters: string[] | null
          session_name: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          created_by?: string | null
          status?: string | null
          current_rushee_id?: string | null
          eligible_voters?: string[] | null
          session_name?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          created_by?: string | null
          status?: string | null
          current_rushee_id?: string | null
          eligible_voters?: string[] | null
          session_name?: string | null
        }
      }
      session_rushees: {
        Row: {
          id: string
          session_id: string
          rushee_id: string
          order_index: number
          phase: string | null
          discussion_started_at: string | null
          discussion_extended_at: string | null
          voting_opened_at: string | null
          voting_closed_at: string | null
          result: string | null
          yes_votes: number | null
          no_votes: number | null
          abstain_votes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          rushee_id: string
          order_index: number
          phase?: string | null
          discussion_started_at?: string | null
          discussion_extended_at?: string | null
          voting_opened_at?: string | null
          voting_closed_at?: string | null
          result?: string | null
          yes_votes?: number | null
          no_votes?: number | null
          abstain_votes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          rushee_id?: string
          order_index?: number
          phase?: string | null
          discussion_started_at?: string | null
          discussion_extended_at?: string | null
          voting_opened_at?: string | null
          voting_closed_at?: string | null
          result?: string | null
          yes_votes?: number | null
          no_votes?: number | null
          abstain_votes?: number | null
          created_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          session_rushee_id: string
          brother_id: string
          vote_type: string
          created_at: string
        }
        Insert: {
          id?: string
          session_rushee_id: string
          brother_id: string
          vote_type: string
          created_at?: string
        }
        Update: {
          id?: string
          session_rushee_id?: string
          brother_id?: string
          vote_type?: string
          created_at?: string
        }
      }
    }
  }
}
