export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://reveiai.bubbleapps.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Inputs
    let role = 'KYC Analyst', jd = '', resume = '', expYears = 2;
    if (req.method === 'POST') {
      let raw = ''; try { raw = await new Response(req.body).text(); } catch(_) {}
      let body = {}; try { body = JSON.parse(raw || '{}'); } catch(_) {}
      role     = (body.role     || role).toString();
      jd       = (body.jd       || '').toString().slice(0, 2000);
      resume   = (body.resume   || '').toString().slice(0, 2000);
      expYears = Number(body.expYears); if (!Number.isFinite(expYears) || expYears <= 0) expYears = 2;
    }

    // Question bank (unchanged)
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
      { q: "What’s your approach to name screening variations (transliteration / aliases)?" },
      { q: "How do you ensure ongoing monitoring is effective post-onboarding?" },
      { q: "If the client is in a high-risk jurisdiction, what extra checks do you perform?" }
    ];
    const orderedList = QUESTION_BANK.map((it, i) => `${i+1}. ${it.q}`).join('\n');

    const instructions = `
You are a human HR interviewer. Sound warm and efficient.

OPENING:
- Say: "Hi, I’m your mock HR interviewer. We’ll go one question at a time. To start, please introduce yourself."
- Stop after that sentence.

QUESTION LIST (ask in this exact order, one per turn):
${orderedList}

STRICT TURN-TAKING:
- Exactly ONE question per turn. If you ever asked more than one, immediately restate only a single question.
- After the candidate answers, give a short acknowledgement (pick one naturally): 
  ["Got it, thanks.", "Understood.", "Thanks for explaining.", "Alright, noted."]
  Then ask the NEXT SINGLE question.
- Keep your spoken turn under ~8–10 seconds.
- Never answer on behalf of the candidate. Never provide model/sample answers unless the candidate explicitly asks.

FLOW & NOISE:
- Prefer responsiveness over long silence. If you detect a brief pause, wait a bit; if the pause continues, proceed.
- Ignore small background clicks (keyboard/utensils). Wait for multi-word speech or a 2+ second clean pause.

LEVELING:
- Candidate experience: ${expYears} years in ${role || 'compliance/finance'}.
- Start at beginner/intermediate; escalate only if answers are strong.

CLOSING:
- After the final question, give a short positive summary and thank them. End only if the candidate says "end interview".

CONTEXT (do not recite):
JOB DESCRIPTION (truncated):
${jd}

CANDIDATE RESUME (truncated):
${resume}
`.trim();

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-realtime-preview',
        voice: 'alloy',
        // Looser & more responsive than before
        turn_detection: {
          type: 'server_vad',
          threshold: 0.88,          // a bit more sensitive (less dead air)
          prefix_padding_ms: 350,
          silence_duration_ms: 2200 // ~2.2s before it assumes you're done
        },
        max_response_output_tokens: 120,
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
