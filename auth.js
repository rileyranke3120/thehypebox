import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

// Pre-computed dummy hash — used to run bcrypt even when user doesn't exist,
// preventing timing oracle attacks that reveal whether an email is registered.
const DUMMY_HASH = '$2b$12$AINsE6y.evpGzYbZb9gJkeJFMOxarQRFCFgJTQHjKg2fETsSLSafm';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// IP-based rate limit: 10 auth attempts per minute — atomic via stored procedure
async function checkAuthRateLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false; // fail closed if not configured
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_auth_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: ip, p_max: 10, p_window_seconds: 60 }),
    });
    return res.ok ? await res.json() : false; // fail closed if RPC unavailable
  } catch {
    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = req?.headers?.get('x-real-ip') || req?.headers?.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
        const allowed = await checkAuthRateLimit(ip);
        if (!allowed) return null;

        const supabase = createClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, password_hash, name, role, plan, plan_status, trial_ends_at, retell_agent_id, failed_login_attempts, locked_until, active')
          .eq('email', credentials.email)
          .single();

        // Always run bcrypt regardless of whether user exists — prevents timing oracle
        const hashToCompare = user?.password_hash || DUMMY_HASH;
        const passwordMatch = await bcrypt.compare(credentials.password, hashToCompare);

        if (error || !user) return null;

        // Deactivated accounts cannot log in
        if (user.active === false) return null;

        // Account lockout check
        if (user.locked_until && new Date(user.locked_until) > new Date()) return null;

        if (!passwordMatch) {
          const attempts = (user.failed_login_attempts || 0) + 1;
          const updates = { failed_login_attempts: attempts };
          if (attempts >= 10) {
            updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          }
          supabase.from('users').update(updates).eq('id', user.id).then(() => {});
          return null;
        }

        // Successful login — reset lockout state
        supabase.from('users').update({
          last_login_at: new Date().toISOString(),
          failed_login_attempts: 0,
          locked_until: null,
        }).eq('id', user.id).then(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'client',
          plan: user.plan ?? null,
          plan_status: user.plan_status ?? null,
          trial_ends_at: user.trial_ends_at ?? null,
          retell_agent_id: user.retell_agent_id ?? null,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.plan = user.plan ?? null;
        token.plan_status = user.plan_status ?? null;
        token.trial_ends_at = user.trial_ends_at ?? null;
        token.retell_agent_id = user.retell_agent_id ?? null;
        token._refreshedAt = Date.now();
        return token;
      }

      // Re-read security-critical fields from DB every 5 minutes so role/plan changes
      // take effect without requiring a new login (tokens last 30 days by default).
      const REFRESH_INTERVAL = 5 * 60 * 1000;
      if (!token._refreshedAt || Date.now() - token._refreshedAt > REFRESH_INTERVAL) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from('users')
            .select('role, plan, plan_status, trial_ends_at, retell_agent_id, active')
            .eq('id', token.id)
            .single();
          if (data) {
            token.role = data.role;
            token.plan = data.plan ?? null;
            // Force plan_status to 'canceled' for deactivated accounts so all data gates close
            token.plan_status = data.active === false ? 'canceled' : (data.plan_status ?? null);
            token.trial_ends_at = data.trial_ends_at ?? null;
            token.retell_agent_id = data.retell_agent_id ?? null;
          }
        } catch {}
        token._refreshedAt = Date.now();
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? null;
        session.user.role = token.role;
        session.user.plan = token.plan ?? null;
        session.user.plan_status = token.plan_status ?? null;
        session.user.trial_ends_at = token.trial_ends_at ?? null;
        session.user.retell_agent_id = token.retell_agent_id ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const p = nextUrl.pathname;
      const isProtected =
        p.startsWith('/dashboard') ||
        p.startsWith('/onboarding') ||
        p.startsWith('/api/admin') ||
        p.startsWith('/api/clients') ||
        p.startsWith('/api/overview') ||
        p.startsWith('/api/contacts') ||
        p.startsWith('/api/pipeline') ||
        p.startsWith('/api/billing') ||
        p === '/api/calls-log' ||
        p === '/api/checklist' ||
        p === '/api/create-portal-session' ||
        p === '/api/onboarding' ||
        p === '/api/retell/calls' ||
        p === '/api/retell/agent' ||
        p === '/api/retell/provision' ||
        p.startsWith('/api/appointments') ||
        p.startsWith('/api/account');
      if (isProtected) {
        return isLoggedIn;
      }
      return true;
    },
  },
});
