import { redirect } from 'next/navigation'

// Manual interview score entry was replaced by in-platform interview mode.
// Scores now live in interview_assignments / interview_answers.
// Admin users go to /brother/interviews to start a session or
// /admin/interview-questions to edit the rubric.
export default function AdminInterviewsPage() {
  redirect('/admin/interview-questions')
}
