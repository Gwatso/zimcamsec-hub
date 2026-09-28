import "server-only";
import { randomInt } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { SUPPORT_CATEGORIES } from "@/lib/validation";
import { getDb } from "../db/client";
import { supportTickets, type SupportTicketRow } from "../db/schema";
import { getEnv } from "../env";
import { log } from "../logger";
import { sendMail } from "../mail";

/** Unambiguous alphabet (no 0/O, 1/I) — references get read out over the phone. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateReference(): string {
  let out = "ZCH-";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export interface NewTicket {
  firstName: string;
  surname: string;
  email: string;
  phone?: string;
  category: string;
  message: string;
  userId: string | null;
  ipHash: string;
}

/** Hard cap per IP per day on top of the per-hour in-memory limiter (survives restarts). */
const DAILY_TICKETS_PER_IP = 15;

export async function tooManyTicketsToday(ipHash: string): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.ipHash, ipHash), gte(supportTickets.createdAt, since)));
  return (row?.n ?? 0) >= DAILY_TICKETS_PER_IP;
}

/**
 * Persist first, then e-mail. The ticket is never lost if the mail provider
 * is down; delivery status is recorded and can be retried from the admin desk.
 */
export async function createTicket(input: NewTicket): Promise<SupportTicketRow> {
  const db = await getDb();
  let ticket: SupportTicketRow | undefined;
  for (let attempt = 0; attempt < 3 && !ticket; attempt++) {
    [ticket] = await db
      .insert(supportTickets)
      .values({ ...input, phone: input.phone ?? null, reference: generateReference() })
      .onConflictDoNothing({ target: supportTickets.reference })
      .returning();
  }
  if (!ticket) throw new Error("Could not allocate a ticket reference");
  return deliverTicket(ticket);
}

export async function deliverTicket(ticket: SupportTicketRow): Promise<SupportTicketRow> {
  const env = getEnv();
  const category = SUPPORT_CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category;
  const result = await sendMail({
    to: env.SUPPORT_INBOX,
    replyTo: ticket.email,
    subject: `[${ticket.reference}] ${category} — ${ticket.firstName} ${ticket.surname}`,
    text: [
      `Reference: ${ticket.reference}`,
      `From: ${ticket.firstName} ${ticket.surname} <${ticket.email}>`,
      `Phone: ${ticket.phone ?? "—"}`,
      `Subject: ${category}`,
      `Signed-in account: ${ticket.userId ? "yes" : "no"}`,
      `Received: ${ticket.createdAt.toISOString()}`,
      "",
      ticket.message,
    ].join("\n"),
  });

  const deliveryStatus = result.status;
  const deliveryError = result.status === "failed" ? result.error.slice(0, 500) : null;
  if (result.status === "failed") log("error", "support ticket e-mail failed", { reference: ticket.reference, error: deliveryError });

  const db = await getDb();
  const [updated] = await db
    .update(supportTickets)
    .set({ deliveryStatus, deliveryError, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id))
    .returning();
  return updated ?? ticket;
}

export async function listTickets(status: "open" | "resolved" | "all", limit = 100) {
  const db = await getDb();
  return db
    .select()
    .from(supportTickets)
    .where(status === "all" ? undefined : eq(supportTickets.status, status))
    .orderBy(desc(supportTickets.createdAt))
    .limit(limit);
}

export async function getTicket(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  return row ?? null;
}

export async function setTicketStatus(id: string, status: "open" | "resolved") {
  const db = await getDb();
  await db.update(supportTickets).set({ status, updatedAt: new Date() }).where(eq(supportTickets.id, id));
}

export async function countOpenTickets(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, "open"));
  return row?.n ?? 0;
}
