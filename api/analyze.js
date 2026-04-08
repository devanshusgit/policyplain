export default async function handler(req, res) {
  // CORS headers for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { policyText } = req.body;

    if (!policyText || typeof policyText !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid policyText' });
    }

    // Trim to max 8000 characters
    const trimmedText = policyText.trim().slice(0, 8000);

    const prompt = `You are an insurance policy analyst in India. Analyze this insurance policy and return ONLY a JSON object — no markdown, no backticks, no explanation. Just raw JSON.

{
  "policyType": "e.g. Health, Term Life, Motor, Home",
  "insurer": "company name",
  "coverageAmount": "sum insured amount",
  "premiumAmount": "premium if mentioned",
  "policyPeriod": "start and end dates if found",
  "covered": ["max 10 items — what IS covered, simple plain English"],
  "notCovered": ["max 10 items — exclusions in simple plain English"],
  "waitingPeriods": ["any waiting periods mentioned"],
  "hiddenClauses": ["clauses that seem unfair or that most people would miss"],
  "claimProcess": "how to raise a claim in 2-3 simple sentences",
  "plainSummary": "3 sentence plain English summary of this policy",
  "riskScore": 7,
  "riskReason": "one sentence explaining this score"
}

Policy text:
${trimmedText}`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorText);
      return res.status(500).json({ error: 'Groq API error', details: errorText });
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    // Try to parse JSON
    try {
      // Strip any accidental markdown code fences if model added them
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      return res.status(200).json(parsed);
    } catch (parseError) {
      console.error('JSON parse failed:', parseError.message);
      return res.status(200).json({ error: 'parse_failed', raw: content });
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
