export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://reveiai.bubbleapps.io'); // <-- your Bubble origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Parse incoming JSON (role / jd / resume / expYears)
    let role = '', jd = '', resume = '', expYears = 2;

    if (req.method === 'POST') {
      // Read body safely
      let raw = '';
      try { raw = await new Response(req.body).text(); } catch (_) {}
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (_) {}

      role     = (body.role     || '').toString();
      jd       = (body.jd       || '').toString().slice(0, 2000);
      resume   = (body.resume   || '').toString().slice(0, 2000);
      expYears = Number(body.expYears);
      if (!Number.isFinite(expYears) || expYears <= 0) expYears = 2; // default
    }

    const instructions = `
You are an HR interviewer for ${role || 'compliance/finance'} roles.

OPENING:
- Greet the candidate briefly.
- Start with a friendly greeting and ask for a short self-introduction. Let the candidate finish fully before moving to the next question.
- Do NOT ask any other question in the opening turn.

INTERVIEW RULES:
- EXACTLY ONE question per turn. Never stack questions.
- Keep each question under ~12 seconds of speech.
- Acknowledge in 2–6 words max (no parroting), then ask the next single question.
- Use the JD/Resume context to tailor questions.

LEVELING:
- Candidate experience: ${expYears} years. Start at beginner/intermediate difficulty; only escalate if answers are strong.

SILENCE & FLOW:
- If you detect short background noise or very short utterances, ignore and wait.
- If there's a long pause, say "Shall I continue?" then ask the next single question.

CLOSING:
- End only when the candidate says "end interview", otherwise end with a short summary and thanks.

JOB DESCRIPTION (truncated):
${jd}

CANDIDATE RESUME (truncated):
${resume}
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
        turn_detection: { type: 'server_vad', threshold: 0.9, prefix_padding_ms: 400, silence_duration_ms: 5000 },
        max_response_output_tokens: 140,
        modalities: ['text','audio'],
        instructions
      })
    });

    const data = await r.json();
    // If OpenAI returns an error, surface it (helps debugging from browser)
    if (data?.error) {
      return res.status(400).json(data);
    }
    return res.status(200).json(data); // includes client_secret
  } catch (e) {
    console.error('Realtime session error:', e);
    return res.status(500).json({ error: (e && e.message) || 'server error' });
  }
}
