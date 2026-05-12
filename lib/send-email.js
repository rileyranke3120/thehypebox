import { getMailer } from '@/lib/mailer';

/**
 * Send an email via GoDaddy SMTP.
 * @param {{ to: string, subject: string, html: string }} options
 */
export async function sendEmail({ to, subject, html }) {
  await getMailer().sendMail({
    from: '"TheHypeBox" <riley@thehypeboxllc.com>',
    to,
    subject,
    html,
  });
}
