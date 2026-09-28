/**
 * Outbound e-mail via the Resend HTTP API (plain fetch — no SDK dependency).
 * Without RESEND_API_KEY, mail is "not_configured": callers must still persist
 * the message so nothing is lost (support tickets are always stored first).
 */
import { getEnv } from "./env";
import { log } from "./logger";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export type MailResult = { status: "sent"; id?: string } | { status: "not_configured" } | { status: "failed"; error: string };

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    log("warning", "mail not configured; message stored only", { to: message.to, subject: message.subject });
    return { status: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        reply_to: message.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      return { status: "failed", error: `HTTP ${response.status}: ${body}` };
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", id: data.id };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}
