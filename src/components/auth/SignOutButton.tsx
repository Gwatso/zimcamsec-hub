"use client";

import { LogOut } from "lucide-react";
import { signOutAction, signOutEverywhereAction } from "@/actions/auth";
import { clearPrivateOfflineData } from "@/lib/client/offline-docs";

/** Clears device-local private data before the server ends the session. */
export function SignOutButton({ everywhere = false, className }: { everywhere?: boolean; className?: string }) {
  return (
    <form
      action={everywhere ? signOutEverywhereAction : signOutAction}
      onSubmit={() => {
        void clearPrivateOfflineData().catch(() => undefined);
      }}
    >
      <button type="submit" className={className ?? "btn-ghost"}>
        <LogOut aria-hidden className="size-4" />
        {everywhere ? "Sign out on all devices" : "Sign out"}
      </button>
    </form>
  );
}
