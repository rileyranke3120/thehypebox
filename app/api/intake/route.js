import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/send-email';
import { createClient } from '@/lib/supabase';
import { createSubAccount } from '@/lib/highlevel';
import { highLevelAccessEmail } from '@/lib/email-templates';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.ADMIN_SECRET || authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const {
      owner_name, business_name, phone, email,
      address, ein, services, google_url, yelp_url,
      facebook_url, other_review_url, plan, notes,
    } = data;

    if (!business_name || !phone || !owner_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Auto-provision GHL if email + plan provided ─────────────────────────
    let ghlResult = null;
    let ghlError = null;

    if (email && plan && plan !== 'Founders Box — Custom') {
      try {
        const supabase = createClient();

        // Upsert user row so the GHL account has a home in our DB
        const planSlug = plan.includes('Velocity') ? 'velocity'
          : plan.includes('Rocket') ? 'rocket'
          : plan.includes('Launch') ? 'launch'
          : 'launch';

        await supabase.from('users').upsert({
          email: email.toLowerCase(),
          name: owner_name,
          business_name,
          business_phone: phone,
          address,
          google_review_url: google_url || null,
          plan: planSlug,
          plan_status: 'trialing',
        }, { onConflict: 'email' });

        ghlResult = await createSubAccount({
          name: owner_name,
          email,
          phone,
          plan: planSlug,
          businessName: business_name,
        });

        // Save GHL IDs back to Supabase
        const ghlUpdates = {
          ghl_location_id: ghlResult.locationId,
          ghl_user_id: ghlResult.userId,
        };
        if (ghlResult.retellAgentId) ghlUpdates.retell_agent_id = ghlResult.retellAgentId;

        await supabase.from('users').update(ghlUpdates).eq('email', email.toLowerCase());

        // Email GHL credentials to the client
        if (ghlResult.userId && ghlResult.password) {
          const tpl = highLevelAccessEmail({
            name: owner_name,
            plan: planSlug,
            locationId: ghlResult.locationId,
            hlEmail: email,
            hlPassword: ghlResult.password,
            dashboardUrl: ghlResult.dashboardUrl,
          });
          await sendEmail({ to: email, ...tpl });
        }
      } catch (err) {
        ghlError = err.message;
        console.error('[api/intake] GHL provisioning failed:', err.message);
      }
    }

    // ── Email Riley the intake summary ───────────────────────────────────────
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const row = (label, value) => value
      ? `<tr><td style="padding:8px 12px;color:#888;font-size:0.8rem;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:8px 12px;color:#fff;font-size:0.875rem;">${value}</td></tr>`
      : '';

    const safeUrl = (u) => u && /^https?:\/\//i.test(u) ? u : null;

    const ghlStatus = ghlResult
      ? `<div style="margin-bottom:24px;padding:12px 16px;background:#0a2a0a;border:1px solid #1a4a1a;border-radius:6px;color:#4CAF50;font-size:0.875rem;">✓ GHL sub-account auto-provisioned — Location ID: ${esc(ghlResult.locationId)}</div>`
      : ghlError
      ? `<div style="margin-bottom:24px;padding:12px 16px;background:#2a0a0a;border:1px solid #4a1a1a;border-radius:6px;color:#E24B4A;font-size:0.875rem;">⚠ GHL provisioning failed: ${esc(ghlError)} — provision manually at /dashboard/admin/highlevel</div>`
      : '';

    await sendEmail({
      to: 'riley@thehypeboxllc.com',
      subject: `New Client Intake: ${esc(business_name)}${ghlResult ? ' ✓ GHL Provisioned' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
          <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

            <div style="margin-bottom:24px;">
              <span style="font-size:1.2rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
              <span style="display:block;font-size:0.75rem;color:#555;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">New Client Intake</span>
            </div>

            <h1 style="font-size:1.5rem;font-weight:800;color:#fff;margin:0 0 24px;">${esc(business_name)}</h1>

            ${ghlStatus}

            <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              ${row('Owner', esc(owner_name))}
              ${row('Business', esc(business_name))}
              ${row('Phone', esc(phone))}
              ${row('Email', esc(email))}
              ${row('Address', esc(address))}
              ${row('EIN', esc(ein))}
              ${row('Plan', esc(plan))}
            </table>

            <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr><td colspan="2" style="padding:10px 12px;color:#555;font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1a1a1a;">Services Offered</td></tr>
              <tr><td colspan="2" style="padding:12px;color:#ddd;font-size:0.875rem;line-height:1.6;">${esc(services || '—').replace(/\n/g, '<br>')}</td></tr>
            </table>

            <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              ${row('Google Reviews', safeUrl(google_url) ? `<a href="${esc(safeUrl(google_url))}" style="color:#FFD000;">${esc(google_url)}</a>` : null)}
              ${row('Yelp', safeUrl(yelp_url) ? `<a href="${esc(safeUrl(yelp_url))}" style="color:#FFD000;">${esc(yelp_url)}</a>` : null)}
              ${row('Facebook', safeUrl(facebook_url) ? `<a href="${esc(safeUrl(facebook_url))}" style="color:#FFD000;">${esc(facebook_url)}</a>` : null)}
              ${row('Other', safeUrl(other_review_url) ? `<a href="${esc(safeUrl(other_review_url))}" style="color:#FFD000;">${esc(other_review_url)}</a>` : null)}
            </table>

            ${notes ? `
            <table style="width:100%;border-collapse:collapse;background:#111;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr><td colspan="2" style="padding:10px 12px;color:#555;font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;border-bottom:1px solid #1a1a1a;">Notes</td></tr>
              <tr><td colspan="2" style="padding:12px;color:#ddd;font-size:0.875rem;line-height:1.6;">${esc(notes).replace(/\n/g, '<br>')}</td></tr>
            </table>
            ` : ''}

          </div>
        </body>
        </html>
      `,
    });

    return NextResponse.json({ ok: true, ghlProvisioned: !!ghlResult });
  } catch (err) {
    console.error('[api/intake]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
