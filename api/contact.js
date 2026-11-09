// Vercel serverless function: receives the contact form and emails it via Resend.
// Environment variables (set in Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY  – your Resend API key
//   CONTACT_TO      – where messages should go, e.g. you@yourdomain.com
//   CONTACT_FROM    – a sender on a domain verified in Resend, e.g. "Sym Ventures <noreply@symventuresllc.com>"

const TOPICS = new Set([
  'Investment in my business or product',
  'Selling a property',
  'Building an app or website',
  'Something else',
]);

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const topic = String(body.topic || '').trim();
  const message = String(body.message || '').trim().slice(0, 5000);

  // Honeypot: real people never fill this hidden field.
  if (body.company) return res.status(200).json({ ok: true });

  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !TOPICS.has(topic)) {
    return res.status(400).json({ error: 'Please fill in every field with a valid email.' });
  }

  const html = `
    <h2>New message from symventuresllc.com</h2>
    <p><strong>Name:</strong> ${escape(name)}</p>
    <p><strong>Email:</strong> ${escape(email)}</p>
    <p><strong>Topic:</strong> ${escape(topic)}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escape(message)}</p>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM,
        to: [process.env.CONTACT_TO],
        reply_to: email,
        subject: `Sym Ventures inquiry: ${topic} — ${name}`,
        html,
      }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Could not send right now.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not send right now.' });
  }
}
