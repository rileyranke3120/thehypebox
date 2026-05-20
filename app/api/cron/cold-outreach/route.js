import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://thehypeboxllc.com';

// Days to wait before sending the next step
const STEP_DELAYS = { 0: 0, 1: 4, 2: 5 };

function unsubscribeUrl(id) {
  return `${APP_URL}/api/outreach/unsubscribe?id=${id}`;
}

function auditUrl(id) {
  return `${APP_URL}/audit?id=${id}`;
}

function auditPS(prospect) {
  return `
    <div style="margin-top:28px;padding:16px 20px;background:#f9f9f9;border-left:3px solid #FFD000;border-radius:0 4px 4px 0;">
      <p style="margin:0;font-size:0.88rem;color:#444;line-height:1.6;">
        <strong style="color:#111;">P.S.</strong> — I ran a free marketing audit on <strong>${prospect.company || 'your business'}</strong> and the score wasn't great.
        <a href="${auditUrl(prospect.id)}" style="color:#000;font-weight:700;text-decoration:underline;">Click here to see your report →</a>
      </p>
    </div>`;
}

function emailWrapper(content, id) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:#0a0a0a;padding:24px 32px;text-align:left;">
      <span style="font-size:1.1rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;font-size:0.97rem;color:#222;line-height:1.8;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="background:#0a0a0a;padding:20px 32px;text-align:center;">
      <p style="font-size:0.72rem;color:#555;margin:0;line-height:1.8;">
        TheHypeBox LLC · 243 Cherrington Rd, Westerville OH 43081<br>
        <a href="${unsubscribeUrl(id)}" style="color:#555;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildEmail(step, prospect) {
  const first = prospect.first_name || 'there';

  if (step === 0) {
    return {
      subject: `Missing calls, ${first}?`,
      html: emailWrapper(`
        <p style="margin:0 0 16px;">Hey ${first},</p>
        <p style="margin:0 0 16px;">Quick question — when you're on a job and a new customer calls, what happens to that call?</p>
        <p style="margin:0 0 16px;">Most contractors in Columbus say the same thing: voicemail, no message left, job goes to whoever picked up.</p>
        <p style="margin:0 0 16px;">I built an AI system for home service businesses that <strong>answers every call, books the appointment, and follows up with leads automatically</strong> — 24/7, even when you're on the job.</p>

        <!-- Feature pills -->
        <div style="margin:24px 0;display:flex;flex-wrap:wrap;gap:8px;">
          ${['📞 Answers every call', '📅 Books appointments', '💬 Instant lead follow-up', '⭐ Review automation'].map(f =>
            `<span style="display:inline-block;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:20px;padding:6px 14px;font-size:0.82rem;color:#333;">${f}</span>`
          ).join('')}
        </div>

        <p style="margin:0 0 24px;">Free 14-day trial. No credit card. One day to set up.</p>

        <a href="${APP_URL}" style="display:inline-block;background:#FFD000;color:#000;font-weight:800;font-size:0.95rem;padding:14px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;">See How It Works →</a>

        <p style="margin:28px 0 0;color:#666;">— Riley<br><span style="font-size:0.82rem;">Founder, TheHypeBox</span></p>
        ${auditPS(prospect)}
      `, prospect.id),
    };
  }

  if (step === 1) {
    return {
      subject: `What it actually looks like`,
      html: emailWrapper(`
        <p style="margin:0 0 16px;">Hey ${first},</p>
        <p style="margin:0 0 16px;">Wanted to show you what this actually does — not just tell you.</p>

        <!-- What happens box -->
        <div style="background:#f9f9f9;border-left:3px solid #FFD000;padding:20px 24px;margin:20px 0;border-radius:0 4px 4px 0;">
          <p style="margin:0 0 12px;font-weight:700;font-size:0.9rem;color:#111;text-transform:uppercase;letter-spacing:0.05em;">When someone calls your business:</p>
          <p style="margin:0 0 8px;font-size:0.9rem;color:#444;">→ AI answers instantly, 24/7</p>
          <p style="margin:0 0 8px;font-size:0.9rem;color:#444;">→ Captures their name, number & what they need</p>
          <p style="margin:0 0 8px;font-size:0.9rem;color:#444;">→ Books them on your calendar automatically</p>
          <p style="margin:0;font-size:0.9rem;color:#444;">→ You get a notification. They get a confirmation text.</p>
        </div>

        <div style="background:#f9f9f9;border-left:3px solid #FFD000;padding:20px 24px;margin:20px 0;border-radius:0 4px 4px 0;">
          <p style="margin:0 0 12px;font-weight:700;font-size:0.9rem;color:#111;text-transform:uppercase;letter-spacing:0.05em;">When a new lead comes in from Google:</p>
          <p style="margin:0 0 8px;font-size:0.9rem;color:#444;">→ They get a text back in under 60 seconds</p>
          <p style="margin:0;font-size:0.9rem;color:#444;">→ Most competitors take hours — you respond first, you win the job</p>
        </div>

        <p style="margin:0 0 24px;">See it live:</p>
        <a href="${APP_URL}/demo" style="display:inline-block;background:#FFD000;color:#000;font-weight:800;font-size:0.95rem;padding:14px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;">View Live Demo →</a>

        <p style="margin:28px 0 0;color:#666;">— Riley<br><span style="font-size:0.82rem;">Founder, TheHypeBox</span></p>
        ${auditPS(prospect)}
      `, prospect.id),
    };
  }

  // step === 2
  return {
    subject: `Last one from me`,
    html: emailWrapper(`
      <p style="margin:0 0 16px;">Hey ${first},</p>
      <p style="margin:0 0 16px;">Last email, I promise.</p>
      <p style="margin:0 0 16px;">If missing calls isn't costing you anything, ignore this. But if you're losing even 2–3 jobs a month to it:</p>

      <!-- Math box -->
      <div style="background:#0a0a0a;color:#fff;padding:20px 24px;margin:20px 0;border-radius:4px;">
        <p style="margin:0 0 8px;font-size:0.9rem;color:#aaa;">2 missed jobs/month × $1,000 avg job =</p>
        <p style="margin:0 0 12px;font-size:1.4rem;font-weight:900;color:#FFD000;">$2,000/month walking out the door</p>
        <p style="margin:0;font-size:0.82rem;color:#666;">The Hype Box starts at $97/mo</p>
      </div>

      <p style="margin:0 0 24px;">14-day free trial. No card required. Cancel anytime.</p>
      <a href="${APP_URL}" style="display:inline-block;background:#FFD000;color:#000;font-weight:800;font-size:0.95rem;padding:14px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.04em;text-transform:uppercase;">Start Free Trial →</a>

      <p style="margin:28px 0 0;color:#666;">— Riley<br><span style="font-size:0.82rem;">Founder, TheHypeBox</span></p>
      ${auditPS(prospect)}
    `, prospect.id),
  };
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const { data: prospects, error } = await supabase
    .from('cold_outreach')
    .select('id, email, first_name, last_name, company, sequence_step')
    .eq('opted_out', false)
    .lt('sequence_step', 3)
    .lte('next_send_at', new Date().toISOString())
    .order('next_send_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[cold-outreach cron] failed to load prospects:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const failures = [];

  for (const prospect of prospects ?? []) {
    try {
      const step = prospect.sequence_step;
      const { subject, html } = buildEmail(step, prospect);

      await sendEmail({ to: prospect.email, subject, html });

      const nextStep = step + 1;
      const delayDays = STEP_DELAYS[nextStep] ?? 0;
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + delayDays);

      await supabase
        .from('cold_outreach')
        .update({
          sequence_step: nextStep,
          last_sent_at: new Date().toISOString(),
          next_send_at: nextSendAt.toISOString(),
        })
        .eq('id', prospect.id);

      sent++;
      console.log(`[cold-outreach] step ${step} sent to ${prospect.email}`);
    } catch (err) {
      console.error(`[cold-outreach] failed for ${prospect.email}:`, err.message);
      failures.push({ email: prospect.email, error: err.message });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: prospects?.length ?? 0,
    sent,
    failed,
    failures,
  });
}
