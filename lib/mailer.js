import nodemailer from 'nodemailer';

let _transporter = null;

export function getMailer() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtpout.secureserver.net',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}
