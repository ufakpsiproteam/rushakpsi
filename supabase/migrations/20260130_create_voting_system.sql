-- Bid Night Voting System Tables
-- Simplified MVP version

-- ============================================
-- VOTING SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS voting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES brothers(id),
  status TEXT CHECK (status IN ('setup', 'active', 'completed')) DEFAULT 'setup',
  current_rushee_id UUID,
  eligible_voters UUID[] DEFAULT '{}',
  session_name TEXT,
  CONSTRAINT fk_current_rushee FOREIGN KEY (current_rushee_id) REFERENCES rushees(id)
);

-- ============================================
-- SESSION RUSHEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS session_rushees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  rushee_id UUID NOT NULL REFERENCES rushees(id),
  order_index INT NOT NULL,
  phase TEXT CHECK (phase IN ('pending', 'discussion', 'voting', 'completed')) DEFAULT 'pending',
  discussion_started_at TIMESTAMPTZ,
  discussion_extended_at TIMESTAMPTZ,
  voting_opened_at TIMESTAMPTZ,
  voting_closed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('pass', 'reject', 'pending')) DEFAULT 'pending',
  yes_votes INT DEFAULT 0,
  no_votes INT DEFAULT 0,
  abstain_votes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_rushee_id UUID NOT NULL REFERENCES session_rushees(id) ON DELETE CASCADE,
  brother_id UUID NOT NULL REFERENCES brothers(id),
  vote_type TEXT CHECK (vote_type IN ('yes', 'no', 'abstain')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_rushee_id, brother_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_votes_session_rushee ON votes(session_rushee_id);
CREATE INDEX idx_votes_brother ON votes(brother_id);
CREATE INDEX idx_session_rushees_session ON session_rushees(session_id);
CREATE INDEX idx_session_rushees_order ON session_rushees(session_id, order_index);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE voting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_rushees ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Voting Sessions Policies
DROP POLICY IF EXISTS "Admins can manage voting sessions" ON voting_sessions;
CREATE POLICY "Admins can manage voting sessions" ON voting_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

DROP POLICY IF EXISTS "Brothers can view active sessions they're eligible for" ON voting_sessions;
CREATE POLICY "Brothers can view active sessions they're eligible for" ON voting_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
    AND (
      status = 'active'
      OR EXISTS (
        SELECT 1 FROM brothers
        WHERE brothers.id = auth.uid()
        AND brothers.access_level IN ('admin', 'pro')
      )
    )
  );

-- Session Rushees Policies
DROP POLICY IF EXISTS "Admins can manage session rushees" ON session_rushees;
CREATE POLICY "Admins can manage session rushees" ON session_rushees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

DROP POLICY IF EXISTS "Brothers can view session rushees for active sessions" ON session_rushees;
CREATE POLICY "Brothers can view session rushees for active sessions" ON session_rushees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM voting_sessions
      WHERE voting_sessions.id = session_rushees.session_id
      AND voting_sessions.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

-- Votes Policies
DROP POLICY IF EXISTS "Admins can view all votes" ON votes;
CREATE POLICY "Admins can view all votes" ON votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

DROP POLICY IF EXISTS "Brothers can insert their own votes" ON votes;
CREATE POLICY "Brothers can insert their own votes" ON votes
  FOR INSERT WITH CHECK (
    auth.uid() = brother_id
    AND EXISTS (
      SELECT 1 FROM session_rushees sr
      JOIN voting_sessions vs ON vs.id = sr.session_id
      WHERE sr.id = session_rushee_id
      AND vs.status = 'active'
      AND sr.phase = 'voting'
      AND auth.uid() = ANY(vs.eligible_voters)
    )
  );

DROP POLICY IF EXISTS "Brothers can view their own votes" ON votes;
CREATE POLICY "Brothers can view their own votes" ON votes
  FOR SELECT USING (auth.uid() = brother_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate voting threshold
CREATE OR REPLACE FUNCTION calculate_voting_threshold(eligible_voters_count INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN FLOOR(eligible_voters_count * 0.25) + 1;
END;
$$;

-- Function to update vote counts after vote insertion
CREATE OR REPLACE FUNCTION update_vote_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE session_rushees
  SET
    yes_votes = (SELECT COUNT(*) FROM votes WHERE session_rushee_id = NEW.session_rushee_id AND vote_type = 'yes'),
    no_votes = (SELECT COUNT(*) FROM votes WHERE session_rushee_id = NEW.session_rushee_id AND vote_type = 'no'),
    abstain_votes = (SELECT COUNT(*) FROM votes WHERE session_rushee_id = NEW.session_rushee_id AND vote_type = 'abstain')
  WHERE id = NEW.session_rushee_id;

  RETURN NEW;
END;
$$;

-- Trigger to auto-update vote counts
DROP TRIGGER IF EXISTS trigger_update_vote_counts ON votes;
CREATE TRIGGER trigger_update_vote_counts
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION update_vote_counts();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON voting_sessions TO authenticated;
GRANT ALL ON session_rushees TO authenticated;
GRANT ALL ON votes TO authenticated;
