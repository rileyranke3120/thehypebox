import { NextResponse } from 'next/server';
import { ghlFetch } from '@/lib/ghl';
import { sendEmail } from '@/lib/send-email';

// Simple in-memory rate limit: 1 submission per email per minute
const rateLimits = new Map();
function checkRateLimit(email) {
  const now = Date.now();
  const last = rateLimits.get(email);
  if (last && now - last < 60_000) return false;
  rateLimits.set(email, now);
  return true;
}

export async function POST(request) {
  try {
    const { name, email, phone, message, subject } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    if (message && message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters.' }, { status: 400 });
    }

    if (!checkRateLimit(email)) {
      return NextResponse.json({ error: 'Please wait a minute before sending another message.' }, { status: 429 });
    }

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    const locationId = process.env.GHL_LOCATION_ID;
    const apiKey = process.env.GHL_API_KEY;

    // ── 1. Create / update contact in GoHighLevel ──────────────
    const contactRes = await ghlFetch('/contacts/', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        locationId,
        source: 'Website',
        tags: ['website-inquiry'],
      }),
    });

    const contactId = contactRes.contact?.id;

    if (contactId && message?.trim()) {
      await ghlFetch(`/contacts/${contactId}/notes`, apiKey, {
        method: 'POST',
        body: JSON.stringify({
          body: `Website inquiry from ${name}${subject ? ` [${subject}]` : ''}:\n\n${message.trim()}`,
        }),
      }).catch((err) => {
        console.warn('Note creation failed:', err.message);
      });
    }

    // ── 2. Email notification to riley@thehypeboxllc.com ───────
    const subjectLine = subject ? `[Contact Form] ${subject}` : `[Contact Form] Message from ${name}`;
    try {
      await sendEmail({
        to: 'riley@thehypeboxllc.com',
        subject: subjectLine,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
            <div style="margin-bottom:24px;"><span style="font-size:1.2rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX — Contact Form</span></div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;width:80px;">From</td><td style="padding:8px 0;color:#fff;">${name}</td></tr>
              <tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#FFD000;">${email}</a></td></tr>
              ${subject ? `<tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Subject</td><td style="padding:8px 0;color:#fff;">${subject}</td></tr>` : ''}
              ${phone ? `<tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Phone</td><td style="padding:8px 0;color:#fff;">${phone}</td></tr>` : ''}
            </table>
            <div style="background:#111;border:1px solid #222;border-radius:4px;padding:20px;">
              <p style="font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Message</p>
              <p style="color:#ccc;font-size:0.95rem;line-height:1.7;margin:0;white-space:pre-wrap;">${(message || '').replace(/</g, '&lt;')}</p>
            </div>
            <p style="font-size:0.75rem;color:#444;margin:24px 0 0;">Submitted ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET</p>
          </div>
        </body></html>`,
      });
    } catch (emailErr) {
      console.error('[contact] notification email failed:', emailErr.message);
    }

    // ── 3. Confirmation email to the user ──────────────────────
    const firstName2 = firstName || name;
    try {
      await sendEmail({
        to: email,
        subject: "We received your message — TheHypeBox",
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
            <div style="margin-bottom:32px;"><span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span></div>
            <h1 style="font-size:1.5rem;font-weight:800;color:#fff;margin:0 0 8px;">Got your message, ${firstName2}!</h1>
            <p style="font-size:0.95rem;color:#999;margin:0 0 24px;">We'll get back to you within 24 hours — usually much faster.</p>
            <div style="background:#111;border:1px solid #222;border-left:3px solid #FFD000;border-radius:4px;padding:20px;margin-bottom:24px;">
              <p style="font-size:0.75rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Your message</p>
              <p style="color:#ccc;font-size:0.9rem;line-height:1.6;margin:0;white-space:pre-wrap;">${(message || '').replace(/</g, '&lt;')}</p>
            </div>
            <p style="font-size:0.82rem;color:#555;line-height:1.6;">Questions? Reply to this email or reach us at <a href="mailto:riley@thehypeboxllc.com" style="color:#FFD000;">riley@thehypeboxllc.com</a></p>
          </div>
        </body></html>`,
      });
    } catch (emailErr) {
      console.error('[contact] confirmation email failed:', emailErr.message);
    }

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to send your message. Please try calling us directly.' }, { status: 500 });
  }
}
