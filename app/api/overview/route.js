import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { getContacts, getOpportunities, getAppointments, getReviews } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

const VALID_STATUSES = ['active', 'trialing'];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkOverviewRateLimit(email) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_checkout_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: `overview:${email}`, p_max: 10, p_window_seconds: 60 }),
    });
    return res.ok ? await res.json() : false;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }
  if (!(await checkOverviewRateLimit(session.user.email))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  try {
    const user = session.user ?? {};
    const isSuperAdmin = user.role === 'super_admin';
    if (isSuperAdmin) {
      return NextResponse.json(await getSuperAdminOverview());
    } else {
      return NextResponse.json(await getClientOverview(user, session));
    }
  } catch (err) {
    console.error('Overview API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Super admin: internal view — clients, MRR, plan breakdown, automation logs (Supabase)
async function getSuperAdminOverview() {
  const supabase = createClient();
  const { data: clients = [] } = await supabase
    .from('users')
    .select('id, business_name, plan, plan_status, active, created_at')
    .eq('role', 'client');

  const clientIds = clients.map((c) => c.id);
  const activeClients = clients.filter((c) => c.plan_status === 'active' || c.plan_status === 'trialing').length;

  const planPrice = { launch: 97, starter: 97, rocket: 297, growth: 297, velocity: 497, pro: 497 };
  const isActive = (c) => c.plan_status === 'active' || c.plan_status === 'trialing';
  const monthlyRevenue = clients
    .filter(isActive)
    .reduce((sum, c) => sum + (planPrice[c.plan] || 0), 0);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newClientsThisMonth = clients.filter((c) => c.created_at >= thirtyDaysAgo).length;

  const planBreakdown = { launch: 0, rocket: 0, velocity: 0, starter: 0, growth: 0, pro: 0 };
  clients.forEach((c) => { if (planBreakdown[c.plan] !== undefined) planBreakdown[c.plan]++; });

  let logsQuery = supabase
    .from('automation_logs')
    .select('id, automation, status, triggered_at, client_id')
    .order('triggered_at', { ascending: false })
    .limit(10);
  if (clientIds.length) logsQuery = logsQuery.in('client_id', clientIds);
  const { data: recentLogs = [] } = await logsQuery;

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.business_name]));
  const recentActivity = (recentLogs ?? []).map((l) => ({
    ...l,
    business_name: clientMap[l.client_id] || 'Unknown',
  }));

  return {
    isSuperAdmin: true,
    stats: {
      totalClients: clients.length,
      activeClients,
      monthlyRevenue,
      newClientsThisMonth,
      planBreakdown,
      // client-facing stats not shown on super admin view
      callsThisMonth: null,
      apptThisMonth: null,
      reviewsThisMonth: null,
      leadsActive: null,
    },
    recentActivity,
    clients,
  };
}

// Client view: real data from GoHighLevel
async function getClientOverview(user, session) {
  const supabase = createClient();
  const { locationId, apiKey } = await getGHLCredentials(session);
  if (!locationId) throw new Error('No GHL location configured for this account.');
  if (!apiKey) throw new Error('No GHL API key configured for this account.');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [contacts, opportunities, appointments, reviews, recentLogs] = await Promise.all([
    getContacts(locationId, apiKey),
    getOpportunities(locationId, apiKey),
    getAppointments(locationId, thirtyDaysAgo, now, apiKey),
    getReviews(locationId, apiKey),
    // Keep automation logs from Supabase (triggered by this app's automations)
    supabase
      .from('automation_logs')
      .select('id, automation, status, triggered_at, client_id')
      .eq('client_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(10)
      .then(({ data }) => data ?? []),
  ]);

  const reviewsThisMonth = reviews.filter((r) => {
    const d = r.dateAdded || r.createdAt || r.created_at;
    return d && d >= thirtyDaysAgo;
  }).length;

  const openOpps = opportunities.filter((o) => o.status === 'open');
  const leadsActive = openOpps.length;
  const pipelineValue = Math.round(openOpps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0));
  const completedJobs = opportunities.filter((o) => o.status === 'won' || o.status === 'closed_won').length;

  // Missed calls still come from Retell webhook → Supabase
  const { data: missedCalls = [] } = await supabase
    .from('missed_calls')
    .select('id, timestamp')
    .eq('client_id', user.id)
    .gte('timestamp', thirtyDaysAgo);

  return {
    isSuperAdmin: false,
    stats: {
      totalContacts: contacts.length,
      leadsActive,
      pipelineValue,
      completedJobs,
      // not shown in client view
      callsThisMonth: missedCalls.length,
      apptThisMonth: appointments.length,
      reviewsThisMonth,
      totalClients: null,
      activeClients: null,
      monthlyRevenue: null,
      newClientsThisMonth: null,
      planBreakdown: null,
    },
    recentActivity: recentLogs,
    clients: [],
  };
}
