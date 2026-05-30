import { NextResponse } from 'next/server';
import { ghlFetch } from '@/lib/ghl';
import { sendEmail } from '@/lib/send-email';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RPC_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// IP-based rate limit: 5 submissions per hour per IP — atomic via stored procedure
async function checkContactRateLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_contact_rate_limit`, {
      method: 'POST',
      headers: RPC_HEADERS,
      body: JSON.stringify({ p_ip: ip, p_max: 5, p_window_seconds: 3600 }),
    });
    return res.ok ? await res.json() : true; // fail open if RPC unavailable
  } catch {
    return true;
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    if (!(await checkContactRateLimit(ip))) {
      return NextResponse.json({ error: 'Too many submissions — please wait before trying again.' }, { status: 429 });
    }

    const { name, email, phone, message, subject } = await request.json();

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Field length limits
    if (name.length > 100) return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
    if (email.length > 254) return NextResponse.json({ error: 'Email is too long.' }, { status: 400 });
    if (phone && phone.length > 20) return NextResponse.json({ error: 'Phone is too long.' }, { status: 400 });
    if (subject && subject.length > 200) return NextResponse.json({ error: 'Subject is too long.' }, { status: 400 });
    if (message && message.length > 2000) return NextResponse.json({ error: 'Message must be 2000 characters or fewer.' }, { status: 400 });

    if (message && message.length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters.' }, { status: 400 });
    }

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';
    const locationId = process.env.GHL_LOCATION_ID;
    const apiKey = process.env.GHL_API_KEY;

    // ── 1. Create / update contact in GoHighLevel (non-fatal) ──
    let contactId = null;
    try {
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
      contactId = contactRes.contact?.id;

      if (contactId && message?.trim()) {
        await ghlFetch(`/contacts/${contactId}/notes`, apiKey, {
          method: 'POST',
          body: JSON.stringify({
            body: `Website inquiry from ${name}${subject ? ` [${subject}]` : ''}:\n\n${message.trim()}`,
          }),
        }).catch((err) => console.warn('[contact] note creation failed:', err.message));
      }
    } catch (ghlErr) {
      console.error('[contact] GHL contact creation failed (non-fatal):', ghlErr.message);
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
              <tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;width:80px;">From</td><td style="padding:8px 0;color:#fff;">${esc(name)}</td></tr>
              <tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Email</td><td style="padding:8px 0;"><a href="mailto:${esc(email)}" style="color:#FFD000;">${esc(email)}</a></td></tr>
              ${subject ? `<tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Subject</td><td style="padding:8px 0;color:#fff;">${esc(subject)}</td></tr>` : ''}
              ${phone ? `<tr><td style="padding:8px 0;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Phone</td><td style="padding:8px 0;color:#fff;">${esc(phone)}</td></tr>` : ''}
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to send your message. Please try calling us directly.' }, { status: 500 });
  }
}
