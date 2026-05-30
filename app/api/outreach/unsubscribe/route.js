import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe-token';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const sig = searchParams.get('sig');
  if (!id || !sig || !verifyUnsubscribeToken(id, sig)) {
    return new NextResponse('Invalid unsubscribe link.', { status: 400, headers: { 'Content-Type': 'text/plain' } });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('cold_outreach')
    .update({ opted_out: true })
    .eq('id', id);

  if (error) {
    console.error('[unsubscribe]', error.message);
    return new NextResponse('Something went wrong. Please reply to the email to unsubscribe.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <div style="text-align:center;padding:2rem;">
        <p style="color:#FFD000;font-size:1rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Unsubscribed</p>
        <p style="color:#666;font-size:0.9rem;margin-top:0.5rem;">You won't receive any more emails from us.</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
