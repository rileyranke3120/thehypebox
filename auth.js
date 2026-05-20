import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createClient();
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email, password_hash, name, role, plan, plan_status, trial_ends_at, ghl_location_id, ghl_api_key, retell_agent_id')
          .eq('email', credentials.email)
          .single();

        if (error || !user) return null;

        const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role || 'client',
          plan: user.plan ?? null,
          plan_status: user.plan_status ?? null,
          trial_ends_at: user.trial_ends_at ?? null,
          ghl_location_id: user.ghl_location_id ?? null,
          ghl_api_key: user.ghl_api_key ?? null,
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.plan = user.plan ?? null;
        token.plan_status = user.plan_status ?? null;
        token.trial_ends_at = user.trial_ends_at ?? null;
        token.ghl_location_id = user.ghl_location_id ?? null;
        token.ghl_api_key = user.ghl_api_key ?? null;
        token.retell_agent_id = user.retell_agent_id ?? null;
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
        session.user.ghl_location_id = token.ghl_location_id ?? null;
        session.user.ghl_api_key = token.ghl_api_key ?? null;
        session.user.retell_agent_id = token.retell_agent_id ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/onboarding');
      if (isProtected) {
        return isLoggedIn;
      }
      return true;
    },
  },
});
