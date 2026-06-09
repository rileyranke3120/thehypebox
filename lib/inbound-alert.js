import { appendFileSync } from 'fs';
import { sendSMS } from '@/lib/twilio';

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const MODEL = 'claude-sonnet-4-6';
const LOG_PATH = '/tmp/inbound_alert_log.json';

async function callAnthropic(system, userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export async function analyzeLead(contact) {
  const system = `You are a sales intelligence assistant for TheHypeBox LLC, an AI automation SaaS for local home service businesses. Analyze the new inbound lead and write exactly 2-3 sentences: who they are, what trade or niche they likely serve, and why they may be a good prospect for AI automation. Be direct and specific. No fluff.`;

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
  const fields = contact.customFields
    ? Object.entries(contact.customFields).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'None';

  const user = `New lead:
Name: ${name}
Phone: ${contact.phone || 'N/A'}
Email: ${contact.email || 'N/A'}
Business: ${contact.companyName || contact.businessName || 'N/A'}
Source: ${contact.source || contact.leadSource || 'N/A'}
Tags: ${(contact.tags || []).join(', ') || 'None'}
Custom fields: ${fields}`;

  return callAnthropic(system, user);
}

// Returns { callerName, businessName, whatTheyNeed, interestLevel, summary }
export async function analyzeCall(callData) {
  const system = `You are a sales intelligence assistant for TheHypeBox LLC (AI automation SaaS for home service businesses). Analyze this AI phone call and extract key info. Respond ONLY with valid JSON in this exact shape:
{
  "callerName": "string or null",
  "businessName": "string or null",
  "whatTheyNeed": "1-2 sentence description",
  "interestLevel": "hot",
  "summary": "2-3 sentence briefing"
}
interestLevel must be exactly one of: hot, warm, cold.
hot = asking to buy / very interested. warm = interested but not urgent. cold = browsing or unlikely.`;

  const transcript = (callData.transcript || '').slice(0, 2000);
  const user = `Call summary: ${callData.call_summary || 'Not available'}
Transcript: ${transcript || 'Not available'}`;

  const text = await callAnthropic(system, user);
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      callerName: null,
      businessName: null,
      whatTheyNeed: 'Could not parse',
      interestLevel: 'cold',
      summary: text.slice(0, 400),
    };
  }
}

export async function sendAlertSMS(message) {
  const apiKey = process.env.GHL_SMS_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const rileyPhone = process.env.RILEY_PHONE;
  const dadPhone = process.env.DAD_PHONE;

  if (!apiKey || !locationId) {
    console.error('[alert] GHL_SMS_KEY or GHL_LOCATION_ID not set — skipping SMS');
    return;
  }

  const recipients = [rileyPhone, dadPhone].filter(Boolean);
  if (!recipients.length) {
    console.warn('[alert] RILEY_PHONE and DAD_PHONE not configured — SMS not sent');
    return;
  }

  for (const phone of recipients) {
    try {
      await sendSMS(phone, message, { apiKey, locationId });
    } catch (err) {
      console.error('[alert] SMS to', phone, 'failed:', err.message);
    }
  }
}

export function logAlert(entry) {
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n';
  try {
    appendFileSync(LOG_PATH, line);
  } catch {
    // /tmp unavailable in some environments — console is the fallback
  }
  console.log('[inbound-alert]', JSON.stringify(entry));
}
