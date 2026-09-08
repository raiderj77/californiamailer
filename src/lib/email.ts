import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, text, replyTo }: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass || to !== 'hello@californiamailer.com') return { success: false };

  const transport = nodemailer.createTransport({
    host: 'smtp.migadu.com', port: 465, secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await transport.sendMail({
      from: { name: 'CaliforniaMailer', address: user },
      to, subject, text,
      ...(replyTo ? { replyTo: { address: replyTo, name: '' } } : {}),
    });
    return { success: result.accepted.includes(to), id: result.messageId };
  } catch {
    console.error('Quote email delivery failed');
    return { success: false };
  } finally {
    transport.close();
  }
}
