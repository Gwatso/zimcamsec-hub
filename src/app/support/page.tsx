import { Clock, Mail, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import { SupportForm } from "@/components/support/SupportForm";
import { SUPPORT_CATEGORIES } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/session";
import { getEnv } from "@/server/env";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "Get help with your account, downloads, teacher verification or request a missing resource.",
};

const FAQ = [
  {
    q: "Is Zimcamsec Hub really free?",
    a: "Yes. Every resource is free for learners and teachers. We will never charge for access.",
  },
  {
    q: "Why do I need an account to download?",
    a: "Accounts keep learners safe, let you see your download history and let you save documents for offline study. Visitors can preview the first 2 pages of any public resource.",
  },
  {
    q: "How do I save data?",
    a: "Turn on Data-Saver in the top bar. It hides images, pauses live updates and only loads a document when you tap it — and only the pages you scroll to.",
  },
  {
    q: "How long does teacher verification take?",
    a: "Usually up to 2 working days. We check your EC Number and school. You can use all learner resources in the meantime.",
  },
  {
    q: "Is this an official Ministry or ZIMSEC website?",
    a: "No. Zimcamsec Hub is independent and unofficial. We compile publicly circulated documents and are not affiliated with MoPSE, any examination board, Cambridge International or publishers.",
  },
];

type SearchParams = Promise<{ category?: string }>;

export default async function SupportPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const inbox = getEnv().SUPPORT_INBOX;
  const category = SUPPORT_CATEGORIES.some((c) => c.value === params.category) ? params.category : undefined;

  return (
    <div className="container-page py-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold">Help &amp; Support</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Stuck, found an error, or need a resource we don&apos;t have yet? Send us a message — it goes straight to our support team.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <SupportForm
          inbox={inbox}
          defaults={{ firstName: user?.firstName, surname: user?.surname, email: user?.email, category }}
        />

        <aside className="space-y-4">
          <div className="card space-y-3 p-5 text-sm">
            <p className="flex items-start gap-2">
              <Mail aria-hidden className="mt-0.5 size-4 shrink-0 text-heritage-600" />
              <span>
                E-mail us directly at{" "}
                <a href={`mailto:${inbox}`} className="font-semibold text-heritage-700 underline dark:text-heritage-300">
                  {inbox}
                </a>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-heritage-600" />
              <span>We aim to reply within 2 working days.</span>
            </p>
          </div>

          <section className="card p-5" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="flex items-center gap-2 font-semibold">
              <MessageCircleQuestion aria-hidden className="size-5 text-heritage-600" /> Common questions
            </h2>
            <div className="mt-3 divide-y divide-stone-200 dark:divide-stone-800">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-3">
                  <summary className="cursor-pointer text-sm font-medium">{item.q}</summary>
                  <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
