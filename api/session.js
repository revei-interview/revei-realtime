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
        model: 'gpt-4o-mini-realtime',   // if error -> change to 'gpt-4o-mini-realtime-preview'
        voice: 'alloy',                  // realistic HR-style voice
        instructions: `
You are a professional HR interviewer for compliance and finance roles.
Start the session by greeting the candidate, introducing yourself as the HR interviewer.
Then ask the candidate to introduce themselves.
After that, ask questions one by one based on the candidate’s responses.
Be calm, natural, and pause slightly between sentences.
Stop the interview politely when the candidate says "end interview".`,
        modalities: ['text', 'audio']
      })
    });

    const data = await response.json();
    res.status(200).json(data); // ✅ Returns session info with client_secret
  } catch (error) {
    console.error('Realtime session error:', error);
    res.status(500).json({ error: error.message });
  }
}
