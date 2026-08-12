import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireBearer, unwrapAuth, getServiceClient, logAudit } from '@/lib/server-auth'
import { toProfessionalRating } from '@/lib/policy'

/**
 * AI evaluation summary for the bid-night deck — PRD §9.1.
 *
 * The summary is always displayed with a visible AI disclosure and never
 * replaces the underlying evaluations, which are shown alongside it.
 */
export async function POST(request: NextRequest) {
  try {
    const { caller, failure } = unwrapAuth(
      await requireBearer(request.headers.get('authorization'), {
        roles: ['admin', 'professional_chair', 'professional_team'],
      })
    )

    if (failure || !caller) {
      return NextResponse.json({ error: failure?.error ?? 'Unauthorized' }, {
        status: failure?.status ?? 401,
      })
    }

    const supabase = getServiceClient()

    const { rusheeId } = await request.json()

    if (!rusheeId) {
      return NextResponse.json(
        { error: 'Rushee ID is required' },
        { status: 400 }
      )
    }

    // Fetch all evaluations for this rushee
    const { data: evaluations, error: evalsError } = await supabase
      .from('evaluations')
      .select(`
        professional_score,
        professional_na,
        personal_score,
        qualities,
        comments,
        knows_personally,
        brother:brothers(name)
      `)
      .eq('rushee_id', rusheeId)

    if (evalsError) {
      console.error('Error fetching evaluations:', evalsError)
      return NextResponse.json(
        { error: 'Failed to fetch evaluations' },
        { status: 500 }
      )
    }

    // Fetch rushee info
    const { data: rushee, error: rusheeError } = await supabase
      .from('rushees')
      .select('name')
      .eq('id', rusheeId)
      .single()

    if (rusheeError || !rushee) {
      return NextResponse.json(
        { error: 'Rushee not found' },
        { status: 404 }
      )
    }

    if (!evaluations || evaluations.length === 0) {
      // PRD §9.1: return an explicit empty state rather than generating a
      // summary of nothing.
      return NextResponse.json({ summary: null, state: 'no_evaluations' })
    }

    // Format evaluations for the AI prompt
    const formattedEvaluations = evaluations
      .map((evaluation: any, index: number) => {
        const qualities = Array.isArray(evaluation.qualities) ? evaluation.qualities.join(', ') : 'None listed'
        // PRD §9.1: "N/A" when the brother declined to rate, "Not rated"
        // when they simply haven't — the two are distinct (R23).
        const rating = toProfessionalRating(evaluation.professional_score, evaluation.professional_na)
        const professionalScore =
          rating.kind === 'scored' ? `${rating.score}/5` : rating.kind === 'na' ? 'N/A' : 'Not rated'

        return `Evaluation ${index + 1}:
- Professional Score: ${professionalScore}
- Personal Score: ${evaluation.personal_score}/5
- Knows Personally: ${evaluation.knows_personally ? 'Yes' : 'No'}
- Qualities: ${qualities}
- Comments: ${evaluation.comments || 'No comment provided'}`
      })
      .join('\n\n')

    // Create the prompt for OpenAI
    const prompt = `You are summarizing rush evaluations for a business fraternity. Create a concise summary of the brotherhood's overall thoughts on rushee "${rushee.name}".

Guidelines:
- Be objective to what the brothers wrote. Do not advocate for or against the rushee, and do not change the facts.
- Keep it short (4 sentences max)
- Remove filler words and unnecessary pretext
- Mention overall score trends (e.g., "generally high", "mixed", "consistently strong") but DO NOT state specific numerical scores—those are already displayed
- If there are unusual or strongly worded evaluations, include 1-2 brief direct quotes
- Tone should be casual but not trying too hard to be funny—just straightforward
- Assume the audience knows the context (we're brothers in the room together)

Format: provide the evaluation overview.

Evaluations:
${formattedEvaluations}

Provide only the summary text, no additional formatting:`

    // Initialize OpenAI client (only at runtime, not during build)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are summarizing rush evaluations objectively and concisely. Be straightforward, mention score trends, and include direct quotes when notable. Keep it casual but professional.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const summary = completion.choices[0]?.message?.content

    if (!summary) {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      )
    }

    // Save the summary to the database
    const { error: updateError } = await supabase
      .from('rushees')
      .update({ ai_summary: summary })
      .eq('id', rusheeId)

    if (updateError) {
      console.error('Error saving summary:', updateError)
      return NextResponse.json(
        { error: 'Failed to save summary' },
        { status: 500 }
      )
    }

    await logAudit({
      actorId: caller.userId,
      action: 'rushee.summary_generated',
      entityType: 'rushee',
      entityId: rusheeId,
      metadata: { evaluation_count: evaluations.length },
    })

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Error generating AI summary:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
