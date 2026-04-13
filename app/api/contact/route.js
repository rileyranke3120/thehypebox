import { NextResponse } from 'next/server';
import { ghlFetch } from '@/lib/ghl';

export async function POST(request) {
  try {
    const { name, email, phone, message } = await request.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ') || '';

    const locationId = process.env.GHL_LOCATION_ID;

    // Create or update contact in GoHighLevel
    const contactRes = await ghlFetch('/contacts/', {
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

    // Attach the message as a note on the contact
    if (contactId && message?.trim()) {
      await ghlFetch(`/contacts/${contactId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          body: `Website inquiry from ${name}:\n\n${message.trim()}`,
        }),
      }).catch((err) => {
        // Non-fatal — contact was created, note failed
        console.warn('Note creation failed:', err.message);
      });
    }

    return NextResponse.json({ success: true, contactId });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to send your message. Please try calling us directly.' }, { status: 500 });
  }
}
