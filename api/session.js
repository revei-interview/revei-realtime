export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://reveiai.bubbleapps.io'); // <- keep your Bubble origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Accept JSON from Bubble (role / jd / resume)
    let role = '', jd = '', resume = '';
    if (req.method === 'POST') {
      const bodyText = await new Response(req.body).text();
      try {
        const body = JSON.parse(bodyText || '{}');
        role   = (body.role   || '').toString();
        jd     = (body.jd     || '').toString().slice(0, 2000);
        resume = (body.resume || '').toString().slice(0, 2000);
      } catch (_) {}
    }

    const instructions = `
You are a professional HR interviewer for ${role || 'compliance/finance'} roles.
Use the job description and resume context to tailor questions.

JOB DESCRIPTION (truncated):
${jd}

CANDIDATE RESUME (truncated):
${resume}

Rules:
- Do NOT repeat the candidate's words verbatim; acknowledge briefly then move on.
- Ask one question at a time (target ~12 seconds speaking).
- Use targeted follow-ups (regulations, regions, tools, impact, STAR examples).
- Keep momentum; if long silence, say "Shall I continue?" then proceed.
- End only if candidate says "end interview", otherwise close with a short summary.
`;

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  model: 'gpt-4o-mini-realtime-preview',
  voice: 'alloy',

  // Make the model much pickier about what counts as speech,
  // and wait a bit longer before it thinks the candidate finished.
  turn_detection: {
    type: 'server_vad',
    threshold: 0.82,            // ↑ ignore background clinks/short sounds
    prefix_padding_ms: 300,
    silence_duration_ms: 1500   // ↑ wait longer so it doesn't cut off
  },

  max_response_output_tokens: 140,  // keep replies short

  modalities: ['text', 'audio'],

  instructions: `
You are an HR interviewer for ${role || 'compliance/finance'} roles.

OPENING:
- Greet the candidate briefly.
- Ask only ONE question: "Please give a 20-second introduction about yourself."
- Do NOT ask any other question in the opening turn.

INTERVIEW RULES:
- EXACTLY ONE question per turn. Never stack questions.
- If you accidentally asked more than one, immediately pick the most important one and re-ask it alone.
- Keep your question under ~12 seconds of speech.
- Acknowledge the candidate in 2–6 words max (no parroting). Then ask the next single question.
- Use the JD/Resume context to tailor questions.

LEVELING:
- Candidate experience: ${expYears || 2} years. Start at beginner/intermediate difficulty; only escalate if answers are strong.

SILENCE & FLOW:
- If you detect short background noise or very short utterances, ignore and wait.
- If there's a long pause, say "Shall I continue?" then ask the next single question.

CLOSING:
- End only when the candidate says "end interview", otherwise end with a short summary and thanks.

JOB DESCRIPTION (truncated):
${jd}

CANDIDATE RESUME (truncated):
${resume}
`
})

    });

    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    console.error('Realtime session error:', e);
    res.status(500).json({ error: e.message });
  }
}
