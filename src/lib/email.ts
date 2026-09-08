import Mailgun from 'mailgun.js';
import formData from 'form-data';

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from,
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) return { success: false };

  try {
    const mailgun = new Mailgun(formData);
    const client = mailgun.client({ username: 'api', key });
    const result = await client.messages.create(domain, {
      from: from || `CaliforniaMailer <noreply@${domain}>`,
      to: [to],
      subject,
      text: text || '',
      ...(html ? { html } : {}),
    });
    return { success: true, id: result.id };
  } catch {
    console.error('Mailgun delivery failed');
    return { success: false };
  }
}
