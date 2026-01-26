import Mailgun from 'mailgun.js';
import formData from 'form-data';

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});

const DOMAIN = process.env.MAILGUN_DOMAIN || '';

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from = `CaliforniaMailer <noreply@${DOMAIN}>`,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) {
  try {
    const result = await mg.messages.create(DOMAIN, {
      from,
      to: [to],
      subject,
      text: text || '',
      html: html || text || '',
    });
    return { success: true, id: result.id };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
}
