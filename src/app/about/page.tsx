import { Eye, HeartHandshake, Landmark, Megaphone, ShieldCheck, Target, Users, Wifi } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getEnv } from "@/server/env";

export const metadata: Metadata = {
  title: "About · Mission & values",
  description: "Zimcamsec Hub's mission, vision and core values, and how the platform serves Zimbabwe's learners and educators.",
};

const VALUES = [
  { icon: HeartHandshake, title: "Equity & Inclusion", text: "Free access to educational materials for all learners without paywalls or hidden fees." },
  { icon: Landmark, title: "Heritage Alignment", text: "Strict adherence to the MoPSE Heritage-Based Curriculum structure, ECD A through Form 6." },
  { icon: ShieldCheck, title: "Safeguarding & Privacy", text: "Explicit protections for learners aged 17 and under, and verified registration for professional educators." },
  { icon: Megaphone, title: "Transparency & Social Proof", text: "Live download counters on every resource show real community engagement." },
  { icon: Wifi, title: "Bandwidth Efficiency", text: "Data-Saver mode, page-by-page PDF loading and offline saving to minimise mobile data use." },
  { icon: Users, title: "Responsive Support", text: "A dedicated Help & Support desk with structured routing to our team." },
];

const ROLES = [
  { role: "Learner", access: "17 years and under", can: "Past papers, specimen exams, frameworks, study notes and PDF previews." },
  { role: "Teacher / Educator", access: "Verified professional (EC Number & school)", can: "Everything learners get, plus schemes of work, teacher syllabi, administrative circulars and a verified teacher badge." },
  { role: "Administrator", access: "Master Admin", can: "System error logs, user accounts, teacher verification, download metrics and content management." },
];

export default function AboutPage() {
  const inbox = getEnv().SUPPORT_INBOX;
  return (
    <div className="container-page py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-bold tracking-wider text-gold-700 uppercase dark:text-gold-400">About Zimcamsec Hub</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">The elite educational &amp; heritage-based curriculum portal</h1>
        <p className="mt-4 text-lg text-stone-700 dark:text-stone-300">
          Empowering Zimbabwe&apos;s learners and educators through open, fast and accessible learning resources.
        </p>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <Target aria-hidden className="size-7 text-heritage-600" />
          <h2 className="mt-3 text-xl font-bold">Our mission</h2>
          <p className="mt-2 leading-relaxed text-stone-700 dark:text-stone-300">
            To democratise academic opportunities across Zimbabwe by aggregating, indexing and serving curriculum-aligned
            learning materials, specimen exams and official educational guidance — eliminating geographic, financial and
            technological barriers so every learner and teacher can succeed.
          </p>
        </section>
        <section className="card p-6">
          <Eye aria-hidden className="size-7 text-gold-600" />
          <h2 className="mt-3 text-xl font-bold">Our vision</h2>
          <p className="mt-2 leading-relaxed text-stone-700 dark:text-stone-300">
            To be Africa&apos;s premier offline-resilient digital learning repository — setting the benchmark for
            heritage-aligned education, transparent policy distribution and student-centred study support.
          </p>
        </section>
      </div>

      <section className="mt-12" aria-labelledby="values-heading">
        <h2 id="values-heading" className="text-2xl font-bold">Core values</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card p-5">
              <Icon aria-hidden className="size-6 text-heritage-600" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="text-2xl font-bold">Who it&apos;s for</h2>
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-heritage-700 text-white">
              <tr>
                <th scope="col" className="p-3">Role</th>
                <th scope="col" className="p-3">Designation &amp; access</th>
                <th scope="col" className="p-3">Key capabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {ROLES.map((r) => (
                <tr key={r.role}>
                  <th scope="row" className="p-3 font-semibold">{r.role}</th>
                  <td className="p-3">{r.access}</td>
                  <td className="p-3 text-stone-600 dark:text-stone-400">{r.can}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 rounded-2xl border-2 border-gold-500 bg-gold-50 p-6 dark:bg-gold-900/20" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading" className="text-lg font-bold">Disclaimer &amp; public compliance</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
          Zimcamsec Hub is an independent, unofficial platform that indexes and compiles publicly circulated educational
          documents. Zimcamsec Hub is <strong>not</strong> affiliated with, endorsed by, or connected to any National
          Examination Boards, Ministries of Education (including MoPSE), Cambridge International Education, textbook
          publishers, or specific schools. All resources are aggregated from open public channels. Rights holders can
          request removal through <Link href="/support?category=copyright" className="underline">Help &amp; Support</Link> or
          at {inbox}.
        </p>
      </section>
    </div>
  );
}
