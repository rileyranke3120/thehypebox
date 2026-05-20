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

function footer(id) {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:0.75rem;color:#aaa;line-height:1.6;">
      TheHypeBox LLC · 243 Cherrington Rd, Westerville OH 43081<br>
      <a href="${unsubscribeUrl(id)}" style="color:#aaa;">Unsubscribe</a>
    </div>`;
}

function buildEmail(step, prospect) {
  const first = prospect.first_name || 'there';
  const unsub = unsubscribeUrl(prospect.id);

  if (step === 0) {
    return {
      subject: `Missing calls, ${first}?`,
      html: `
        <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;font-size:1rem;color:#111;line-height:1.7;padding:32px 16px;">
          <p>Hey ${first},</p>
          <p>Quick question — when you're on a job and a new customer calls, what happens to that call?</p>
          <p>Most contractors I talk to in Columbus say the same thing: it goes to voicemail, the person doesn't leave one, and that job goes to whoever picked up.</p>
          <p>I built an AI system specifically for home service businesses that answers every call, books the appointment, and follows up with leads automatically — 24/7, even when you're on a roof.</p>
          <p>Free 14-day trial, no credit card needed. Takes one day to set up.</p>
          <p>Worth a look? → <a href="${APP_URL}" style="color:#000;font-weight:600;">thehypeboxllc.com</a></p>
          <p style="margin-top:24px;">— Riley</p>
          ${footer(prospect.id)}
        </div>`,
    };
  }

  if (step === 1) {
    return {
      subject: `What it actually looks like`,
      html: `
        <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;font-size:1rem;color:#111;line-height:1.7;padding:32px 16px;">
          <p>Hey ${first},</p>
          <p>Wanted to show you what the system actually does, not just tell you.</p>
          <p>When someone calls your business: the AI answers, captures their name and what they need, and books them directly onto your calendar. You get a notification. They get a confirmation text.</p>
          <p>When a new lead comes in from your website or Google: they get a text back in under a minute, automatically. Most competitors take hours to respond.</p>
          <p>You can see a live demo here → <a href="${APP_URL}/demo" style="color:#000;font-weight:600;">thehypeboxllc.com/demo</a></p>
          <p>Still free for 14 days if you want to try it on your own business.</p>
          <p style="margin-top:24px;">— Riley</p>
          ${footer(prospect.id)}
        </div>`,
    };
  }

  // step === 2
  return {
    subject: `Last one from me`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;font-size:1rem;color:#111;line-height:1.7;padding:32px 16px;">
        <p>Hey ${first},</p>
        <p>Last email, I promise.</p>
        <p>If missing calls and slow follow-ups aren't a problem for your business, ignore this. But if you're losing even 2–3 jobs a month to it — at $500–$2,000 a job — the math on a $97/mo tool fixes itself pretty fast.</p>
        <p>14-day free trial, no card required, cancel anytime.</p>
        <p>→ <a href="${APP_URL}" style="color:#000;font-weight:600;">thehypeboxllc.com</a></p>
        <p style="margin-top:24px;">— Riley</p>
        ${footer(prospect.id)}
      </div>`,
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
