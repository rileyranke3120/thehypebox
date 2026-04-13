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
          .select('id, email, password_hash, name, role, ghl_location_id, ghl_api_key')
          .eq('email', credentials.email)
          .single();

        if (error || !user) return null;

        const passwordMatch = await bcrypt.compare(credentials.password, user.password_hash);
        if (!passwordMatch) return null;

        console.log('[auth] authorize → user from Supabase:', { email: user.email, ghl_api_key: user.ghl_api_key });
        return { id: user.id, email: user.email, name: user.name, role: user.role || 'client', ghl_location_id: user.ghl_location_id ?? null, ghl_api_key: user.ghl_api_key ?? null };
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
        console.log('[auth] jwt callback → user object:', { email: user.email, ghl_api_key: user.ghl_api_key });
        token.role = user.role;
        token.ghl_location_id = user.ghl_location_id ?? null;
        token.ghl_api_key = user.ghl_api_key ?? null;
        console.log('[auth] jwt callback → token after assign:', { ghl_api_key: token.ghl_api_key });
      }
      return token;
    },
    session({ session, token }) {
      console.log('[auth] session callback → token:', { ghl_api_key: token.ghl_api_key });
      if (session.user) {
        session.user.role = token.role;
        session.user.ghl_location_id = token.ghl_location_id ?? null;
        session.user.ghl_api_key = token.ghl_api_key ?? null;
      }
      console.log('[auth] session callback → session.user:', { ghl_api_key: session.user?.ghl_api_key });
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
