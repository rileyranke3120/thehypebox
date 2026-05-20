import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getContact, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { createClient } from '@/lib/supabase';
import { getGHLCredentials } from '@/lib/ghl-session';

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { apiKey } = await getGHLCredentials(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  try {
    const contact = await getContact(params.id, apiKey);
    return NextResponse.json({ contact });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { apiKey, locationId } = await getGHLCredentials(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'note') {
      const { text } = body;
      if (!text?.trim()) return NextResponse.json({ error: 'Note text required.' }, { status: 400 });
      await addContactNote(params.id, text.trim(), apiKey);
      return NextResponse.json({ ok: true });
    }

    if (action === 'sms') {
      const { phone, message } = body;
      if (!phone || !message) return NextResponse.json({ error: 'phone and message required.' }, { status: 400 });
      await sendSMS(phone, message, { apiKey, locationId });

      const supabase = createClient();
      const { data: user } = await supabase.from('users').select('id').eq('email', session.user.email).single();
      await supabase.from('review_requests').insert({
        phone_number: phone,
        customer_name: body.name || 'Contact',
        client_id: user?.id ?? null,
        sent_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
