export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://reveiai.bubbleapps.io'); // <-- your Bubble origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ---- INPUTS from Bubble (optional) ----
    let role = 'KYC Analyst', jd = '', resume = '', expYears = 2;
    if (req.method === 'POST') {
      let raw = ''; try { raw = await new Response(req.body).text(); } catch(_) {}
      let body = {}; try { body = JSON.parse(raw || '{}'); } catch(_) {}
      role     = (body.role     || role).toString();
      jd       = (body.jd       || '').toString().slice(0, 2000);
      resume   = (body.resume   || '').toString().slice(0, 2000);
      expYears = Number(body.expYears); if (!Number.isFinite(expYears) || expYears <= 0) expYears = 2;
    }

    // ---- QUESTION BANK (one at a time, in order) ----
    const QUESTION_BANK = [
      { q: "What is KYC and why is it important for financial institutions?" },
      { q: "Explain the difference between CDD and EDD, and when to use each." },
      { q: "Walk me through your end-to-end KYC workflow for a UK corporate client." },
      { q: "How do you identify UBOs for layered ownership structures? Give an example." },
      { q: "What sources do you use to verify UK corporate information? (e.g., Companies House)" },
      { q: "Describe your process for PEP screening. How do you confirm a true match vs a false positive?" },
      { q: "What is sanctions screening, and how do you handle a potential sanctions hit?" },
      { q: "How do you conduct adverse media checks, and what would trigger escalation?" },
      { q: "How do you risk-rate a customer? What factors push a case from low to high risk?" },
      { q: "Give an example of a remediation you handled. What was the gap and how did you close it?" },
      { q: "Which tools have you used (e.g., World-Check, Dow Jones)? What are their strengths/limits?" },
      { q: "How do JMLSG guidelines influence UK KYC procedures?" },
      { q: "What documentation do you collect for onboarding vs periodic review?" },
      { q: "How do you evidence and write up your KYC memo for audit/readers?" },
      { q: "Describe a tough case you escalated. To whom, why, and what was the outcome?" },
      { q: "What are common indicators of beneficial ownership obfuscation?" },
      { q: "How do you handle missing or outdated documents during periodic reviews?" },
      { q: "What’s your approach to name screening variations ( transliteration / aliases )?" },
      { q: "How do you ensure ongoing monitoring is effective post-onboarding?" },
      { q: "If the client is in a high-risk jurisdiction, what extra checks do you perform?" }
    ];

    // Build interview script with strict turn-taking and controlled behavior
    const orderedList = QUESTION_BANK.map((it, i) => `${i+1}. ${it.q}`).join('\n');

    const instructions = `
You are an HR interviewer for ${role} roles. The candidate has about ${expYears} years of experience.
You will conduct the interview using the EXACT question list below—STRICT ORDER, ONE question at a time.
Never invent new questions. Never stack multiple questions in one turn.

OPENING:
- Greet the candidate briefly and say you'll ask questions one by one. Do not ask anything else in the opening.

QUESTION LIST:
${orderedList}

RULES:
- One question per turn only. If you ever asked more than one, immediately restate only a single question.
- Keep your speaking turn under ~10–12 seconds.
- Acknowledge the candidate in 2–6 words max (no parroting); then proceed to the next question.
- Wait until the candidate fully finishes. Ignore tiny background noises.
- If there's a long pause, say "Shall I continue?" then proceed to the next single question.
- After the last question, give a brief positive summary and thank them.

CONTEXT (optional, do not recite):
JOB DESCRIPTION (truncated):
${jd}

CANDIDATE RESUME (truncated):
${resume}
    `.trim();

    // Create realtime session
    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-realtime-preview',
        voice: 'alloy',

        // Turn-taking tuned for noisy environments
        turn_detection: {
          type: 'server_vad',
          threshold: 0.90,            // less sensitive to clinks/background
          prefix_padding_ms: 400,
          silence_duration_ms: 4000   // wait longer so users finish
        },

        max_response_output_tokens: 120,  // keep the bot brief
        modalities: ['text', 'audio'],
        instructions
      })
    });

    const data = await r.json();
    if (data?.error) return res.status(400).json(data);
    return res.status(200).json(data);
  } catch (e) {
    console.error('Realtime session error:', e);
    return res.status(500).json({ error: e.message || 'server error' });
  }
}
