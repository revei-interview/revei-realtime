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
        model: 'gpt-4o-mini-realtime-preview', // this worked for you
        voice: 'alloy',
        turn_detection: { type: 'server_vad', threshold: 0.6, prefix_padding_ms: 300, silence_duration_ms: 1200 },
        max_response_output_tokens: 180,
        modalities: ['text','audio'],
        instructions
      })
    });

    const data = await r.json();
    res.status(200).json(data);
  } catch (e) {
    console.error('Realtime session error:', e);
    res.status(500).json({ error: e.message });
  }
}
