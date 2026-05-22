import { Resend } from 'resend';

let _resend = null;

export function getMailer() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }

  // Returns a nodemailer-compatible interface so all existing sendMail() calls work unchanged
  return {
    sendMail: async ({ from, to, subject, html }) => {
      const { error } = await _resend.emails.send({ from, to, subject, html });
      if (error) throw new Error(error.message || 'Resend send failed');
    },
  };
}
