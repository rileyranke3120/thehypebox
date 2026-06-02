export { auth as proxy } from '@/auth';

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/clients/:path*',
    '/dashboard/:path*',
    '/api/overview',
    '/api/contacts/:path*',
    '/api/pipeline/:path*',
    '/api/billing/:path*',
    '/api/calls-log',
    '/api/checklist',
    '/api/create-portal-session',
    '/api/onboarding',
    '/api/retell/:path*',
    '/api/appointments/:path*',
    '/api/automations/:path*',
    '/api/account/:path*',
  ],
};
