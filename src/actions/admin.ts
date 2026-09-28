"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type FormState, echoValues } from "@/lib/form-state";
import { MAX_COVER_BYTES, MAX_PDF_BYTES, fieldErrors, resourceMetadataSchema } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { captureServerError } from "@/server/logger";
import { InvalidPdfError } from "@/server/pdf";
import {
  DuplicateResourceError,
  coverExtension,
  createResource,
  deleteResource,
  setResourcePublished,
} from "@/server/services/admin-resources";
import { purgeErrorLogs } from "@/server/services/error-logs";
import { deliverTicket, getTicket, setTicketStatus } from "@/server/services/support";
import { setTeacherStatus, setUserStatus } from "@/server/services/users";

const id = z.string().uuid();

function formId(formData: FormData, key = "id"): string | null {
  const parsed = id.safeParse(formData.get(key));
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Content management
// ---------------------------------------------------------------------------

export async function createResourceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const values = echoValues(formData);

  const parsed = resourceMetadataSchema.safeParse(Object.fromEntries(formData.entries()));
  const errors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) errors.file = "Choose a PDF file";
  else if (file.size > MAX_PDF_BYTES) errors.file = `PDF must be ${MAX_PDF_BYTES / 1024 / 1024} MB or smaller`;

  const cover = formData.get("cover");
  const hasCover = cover instanceof File && cover.size > 0;
  if (hasCover) {
    if (!coverExtension(cover.type)) errors.cover = "Cover must be JPEG, PNG or WebP";
    else if (cover.size > MAX_COVER_BYTES) errors.cover = `Cover must be ${MAX_COVER_BYTES / 1024} KB or smaller (keep pages light for mobile data)`;
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", errors, values };
  }

  let created: { id: string; slug: string };
  try {
    created = await createResource({
      metadata: parsed.data,
      pdf: new Uint8Array(await (file as File).arrayBuffer()),
      cover: hasCover ? { data: new Uint8Array(await cover.arrayBuffer()), mime: cover.type } : null,
      createdBy: admin.id,
    });
  } catch (error) {
    if (error instanceof InvalidPdfError) return { status: "error", errors: { file: error.message }, values };
    if (error instanceof DuplicateResourceError) {
      return { status: "error", errors: { file: error.message }, values, data: { duplicateSlug: error.existing.slug } };
    }
    await captureServerError(error, { action: "createResource" });
    return { status: "error", message: "Upload failed unexpectedly. The error has been logged.", values };
  }

  revalidatePath("/", "layout");
  redirect(`/admin/resources?created=${encodeURIComponent(created.slug)}`);
}

export async function togglePublishAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const resourceId = formId(formData);
  if (!resourceId) return;
  await setResourcePublished(resourceId, formData.get("publish") === "true");
  revalidatePath("/", "layout");
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const resourceId = formId(formData);
  if (!resourceId || formData.get("confirm") !== "yes") return;
  await deleteResource(resourceId);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function setTeacherStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = formId(formData);
  const status = z.enum(["verified", "rejected", "pending"]).safeParse(formData.get("status"));
  if (!userId || !status.success) return;
  await setTeacherStatus(userId, status.data);
  revalidatePath("/admin/users");
}

export async function setUserStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = formId(formData);
  const status = z.enum(["active", "suspended"]).safeParse(formData.get("status"));
  if (!userId || !status.success || userId === admin.id) return;
  await setUserStatus(userId, status.data);
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Support desk
// ---------------------------------------------------------------------------

export async function setTicketStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ticketId = formId(formData);
  const status = z.enum(["open", "resolved"]).safeParse(formData.get("status"));
  if (!ticketId || !status.success) return;
  await setTicketStatus(ticketId, status.data);
  revalidatePath("/admin/support");
}

export async function retryTicketDeliveryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ticketId = formId(formData);
  if (!ticketId) return;
  const ticket = await getTicket(ticketId);
  if (ticket && ticket.deliveryStatus !== "sent") await deliverTicket(ticket);
  revalidatePath("/admin/support");
}

// ---------------------------------------------------------------------------
// System logs
// ---------------------------------------------------------------------------

export async function purgeLogsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const fingerprint = z.string().regex(/^[0-9a-f]{16}$/).safeParse(formData.get("fingerprint"));
  const days = z.coerce.number().int().min(0).max(365).safeParse(formData.get("olderThanDays"));
  await purgeErrorLogs({
    fingerprint: fingerprint.success ? fingerprint.data : undefined,
    olderThanDays: days.success && !fingerprint.success ? days.data : undefined,
  });
  revalidatePath("/admin/logs");
}
