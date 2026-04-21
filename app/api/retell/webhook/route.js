/**
 * POST /api/retell/webhook
 *
 * Receives post-call events from Retell and forwards them to the
 * GHL (GoHighLevel) webhook URL configured via GHL_RETELL_WEBHOOK_URL.
 *
 * Configure your Retell agent's post-call webhook to:
 *   https://<your-domain>/api/retell/webhook
 */
export async function POST(request) {
  const ghlWebhookUrl = process.env.GHL_RETELL_WEBHOOK_URL;

  if (!ghlWebhookUrl) {
    console.error('[retell/webhook] GHL_RETELL_WEBHOOK_URL is not configured');
    return Response.json({ error: 'GHL_RETELL_WEBHOOK_URL not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  console.log('[retell/webhook] Forwarding to GHL:', ghlWebhookUrl);

  try {
    const ghlRes = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseText = await ghlRes.text();
    console.log(`[retell/webhook] GHL responded ${ghlRes.status}: ${responseText}`);

    return Response.json({ forwarded: true, ghlStatus: ghlRes.status });
  } catch (err) {
    console.error('[retell/webhook] Failed to forward to GHL:', err);
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
