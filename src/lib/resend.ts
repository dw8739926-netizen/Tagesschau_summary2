import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendSummaryEmail(title: string, htmlContent: string) {
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const to = process.env.RESEND_TO_EMAIL || "dw8739926@gmail.com";

  if (!to) {
    console.error("RESEND_TO_EMAIL is not set. Skipping email.");
    return;
  }

  const { data, error } = await resend.emails.send({
    from: `Tagesschau Summary <${from}>`,
    to: [to],
    subject: `Neue Tagesschau Zusammenfassung: ${title}`,
    html: htmlContent,
  });

  if (error) {
    console.error("Error sending email:", error);
    throw error;
  }

  return data;
}
