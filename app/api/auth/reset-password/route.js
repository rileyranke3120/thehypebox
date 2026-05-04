import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateResetToken } from '@/lib/reset-token';
import { sendEmail } from '@/lib/send-email';

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if the user exists — but always return success to prevent email enumeration
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('email', normalizedEmail)
      .single();

    if (user) {
      const token = generateResetToken(normalizedEmail);
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
      const firstName = user.name ? user.name.split(' ')[0] : 'there';

      try {
        await sendEmail({
          to: normalizedEmail,
          subject: 'Reset your TheHypeBox password',
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
            <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
              <div style="margin-bottom:32px;"><span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span></div>
              <h1 style="font-size:1.5rem;font-weight:800;color:#fff;margin:0 0 8px;">Reset your password</h1>
              <p style="font-size:0.95rem;color:#999;margin:0 0 32px;">Hi ${firstName}, click the button below to set a new password. This link expires in 1 hour.</p>
              <a href="${resetUrl}" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">Reset Password →</a>
              <p style="font-size:0.82rem;color:#555;margin:24px 0 0;line-height:1.6;">If you didn't request this, ignore this email — your password won't change.<br>Link expires in 1 hour.</p>
              <p style="font-size:0.78rem;color:#333;margin:16px 0 0;word-break:break-all;">Or copy this URL: ${resetUrl}</p>
            </div>
          </body></html>`,
        });
      } catch (emailErr) {
        console.error('[reset-password] email send failed:', emailErr.message);
      }
    }

    // Always return success — don't reveal whether the email exists
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
