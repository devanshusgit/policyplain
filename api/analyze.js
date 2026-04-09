const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Debug: check key exists
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in environment variables' });
  }

  try {
    const { policyText } = req.body;
    if (!policyText || typeof policyText !== 'string') {
      return res.status(400).json({ error: 'Missing policyText' });
    }

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

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    });

    const groqResult = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const reqHttp = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
      });

      reqHttp.on('error', reject);
      reqHttp.write(body);
      reqHttp.end();
    });

    if (groqResult.status !== 200) {
      console.error('Groq error:', groqResult.status, groqResult.body);
      return res.status(500).json({ error: 'Groq API error', details: groqResult.body });
    }

    const groqData = JSON.parse(groqResult.body);
    const content = groqData.choices?.[0]?.message?.content;

    if (!content) return res.status(500).json({ error: 'Empty response from Groq' });

    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ error: 'parse_failed', raw: content });
    }

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
