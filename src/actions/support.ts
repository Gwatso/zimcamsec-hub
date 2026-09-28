"use server";

import { type FormState, echoValues } from "@/lib/form-state";
import { fieldErrors, supportSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { captureServerError } from "@/server/logger";
import { limits } from "@/server/rate-limit";
import { clientIp, hashIp } from "@/server/request";
import { createTicket, tooManyTicketsToday } from "@/server/services/support";

export async function submitSupportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = echoValues(formData);
  const parsed = supportSchema.safeParse({
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    category: formData.get("category"),
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    // Bots filling the honeypot get a fake success so they don't adapt.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) {
      return { status: "success", data: { reference: "ZCH-RECEIVED", delivery: "sent" } };
    }
    return { status: "error", message: "Please fix the highlighted fields.", errors: fieldErrors(parsed.error), values };
  }

  const ip = await clientIp();
  const ipHash = hashIp(ip);
  if (!limits.support().check(ip).ok || (await tooManyTicketsToday(ipHash))) {
    return {
      status: "error",
      message: `You've sent several messages recently. Please wait a while, or e-mail ${getEnv().SUPPORT_INBOX} directly.`,
      values,
    };
  }

  try {
    const user = await getCurrentUser();
    const { website: _honeypot, ...ticket } = parsed.data;
    const saved = await createTicket({ ...ticket, userId: user?.id ?? null, ipHash });
    return {
      status: "success",
      data: { reference: saved.reference, delivery: saved.deliveryStatus, inbox: getEnv().SUPPORT_INBOX },
    };
  } catch (error) {
    await captureServerError(error, { action: "submitSupport" });
    return {
      status: "error",
      message: `We couldn't send your message right now. Please try again, or e-mail ${getEnv().SUPPORT_INBOX}.`,
      values,
    };
  }
}
