import nodemailer from 'nodemailer';

let _transporter = null;

export function getMailer() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}
