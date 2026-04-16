const AGENT_ID = 'agent_6ebde3bccbc96f8fca6da9b42c';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function getOutcome(call) {
  const reason = call.disconnection_reason;
  const status = call.call_status;
  if (status === 'ongoing' || status === 'registered') return 'Ongoing';
  if (!reason) return 'Ended';
  if (reason === 'user_hangup' || reason === 'agent_hangup') return 'Resolved';
  if (reason === 'call_transfer') return 'Escalated';
  if (reason === 'voicemail_reached') return 'Voicemail';
  if (reason === 'inactivity' || reason === 'machine_detected') return 'Missed';
  return 'Ended';
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function GET() {
  const apiKey = process.env.RETELL_API_KEY;

  if (!apiKey) {
    return Response.json({ calls: [], error: 'RETELL_API_KEY not configured' });
  }

  try {
    const res = await fetch('https://api.retellai.com/v2/call', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return Response.json({ calls: [], error: `Retell API ${res.status}` });
    }

    const raw = await res.json();
    // Retell may return an array directly or { calls: [...] }
    const list = Array.isArray(raw) ? raw : (raw.calls || raw.data || []);

    // Filter to this agent's calls, sort descending by start_timestamp, take 5
    const filtered = list
      .filter((c) => !c.agent_id || c.agent_id === AGENT_ID)
      .sort((a, b) => (b.start_timestamp || 0) - (a.start_timestamp || 0))
      .slice(0, 5);

    const calls = filtered.map((c) => {
      const durationMs =
        c.duration_ms ||
        (c.end_timestamp && c.start_timestamp
          ? c.end_timestamp - c.start_timestamp
          : null);
      return {
        id: c.call_id,
        from: c.from_number || '—',
        duration: formatDuration(durationMs),
        outcome: getOutcome(c),
        time: formatTimestamp(c.start_timestamp),
        status: c.call_status,
      };
    });

    return Response.json({ calls });
  } catch (err) {
    return Response.json({ calls: [], error: String(err) });
  }
}
