export default async function handler(req, res) {
  // ✅ Allow only your Bubble app to call this API
  res.setHeader('Access-Control-Allow-Origin', 'https://reveiai.bubbleapps.io'); // <-- change if you use live domain later
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  model: 'gpt-4o-mini-realtime-preview',      // keep preview if that’s what works
  voice: 'alloy',
  // --- Keep the session alive and detect turns more reliably ---
  turn_detection: { type: 'server_vad', threshold: 0.6, prefix_padding_ms: 300, silence_duration_ms: 900 },
  // --- Cap how long the bot speaks so it doesn't monologue ---
  max_response_output_tokens: 180,
  // --- Interview behavior (stop parroting, keep flow going) ---
  instructions: `
You are a professional HR interviewer for compliance/finance roles.
Start immediately with a short intro, then ask the candidate to introduce themselves.
Conduct a structured interview for 20–30 minutes.

Rules for responses:
- Do NOT repeat the candidate's words verbatim. Acknowledge briefly in 1 short clause, then ask the next question.
- Keep each question under 12 seconds of speech. One question at a time.
- Use targeted follow-ups based on what they said (regions, regulations, tools, impact).
- After the candidate finishes, continue automatically with the next relevant question (no waiting for manual triggers).
- If there's long silence, prompt once: "Shall I continue?" then proceed.
- End politely only if the candidate says "end interview" or after the closing summary.`,
  modalities: ['text','audio']
})
    });

    const data = await response.json();
    res.status(200).json(data); // ✅ Returns session info with client_secret
  } catch (error) {
    console.error('Realtime session error:', error);
    res.status(500).json({ error: error.message });
  }
}
