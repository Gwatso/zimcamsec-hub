import { BadgeCheck, Ban, RotateCcw, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { setTeacherStatusAction, setUserStatusAction } from "@/actions/admin";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Pagination } from "@/components/resources/Pagination";
import { levelLabel } from "@/lib/curriculum";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/format";
import { requireAdmin } from "@/server/auth/guards";
import { ADMIN_USERS_PAGE_SIZE, listUsers } from "@/server/services/users";

export const metadata = { title: "Users" };

type SearchParams = Promise<{ q?: string; role?: string; queue?: string; page?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim().slice(0, 100) || undefined;
  const queue = params.queue === "1";
  const { rows, total } = await listUsers({ q, role: params.role, queue, page });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users ({total})</h1>

      <div className="flex flex-wrap items-end gap-3">
        <Form action="/admin/users" className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="uq" className="field-label">Search</label>
            <input id="uq" name="q" defaultValue={q} placeholder="Name, e-mail, EC Number or school" className="field-input" />
          </div>
          <div>
            <label htmlFor="urole" className="field-label">Role</label>
            <select id="urole" name="role" defaultValue={params.role ?? ""} className="field-input">
              <option value="">All roles</option>
              <option value="learner">Learners</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <button type="submit" className="btn-secondary">Filter</button>
        </Form>
        <Link href={queue ? "/admin/users" : "/admin/users?queue=1"} className={cn(queue ? "btn-gold" : "btn-secondary")}>
          <BadgeCheck aria-hidden className="size-4" /> Verification queue
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500 uppercase dark:border-stone-800 dark:bg-stone-900">
            <tr>
              <th scope="col" className="p-3">User</th>
              <th scope="col" className="p-3">Role</th>
              <th scope="col" className="p-3">Details</th>
              <th scope="col" className="p-3">Joined / last sign-in</th>
              <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-stone-500">No users match.</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className={cn("align-top", u.status === "suspended" && "opacity-60")}>
                <td className="p-3">
                  <div className="font-medium">{u.firstName} {u.surname}</div>
                  <div className="text-xs break-all text-stone-500">{u.email}</div>
                  {u.status === "suspended" && <span className="badge mt-1 bg-red-100 text-red-900">Suspended</span>}
                </td>
                <td className="p-3 capitalize">
                  {u.role}
                  {u.role === "teacher" && (
                    <span className={cn("badge mt-1 block w-fit", u.teacherStatus === "verified" ? "bg-gold-500 text-heritage-950" : u.teacherStatus === "rejected" ? "bg-red-100 text-red-900" : "bg-stone-200 text-stone-800")}>
                      {u.teacherStatus}
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs">
                  {u.role === "teacher" ? (
                    <>
                      <div>EC: <span className="font-mono">{u.ecNumber}</span></div>
                      <div>{u.schoolName}</div>
                    </>
                  ) : u.role === "learner" ? (
                    levelLabel(u.gradeLevel) ?? "—"
                  ) : "—"}
                </td>
                <td className="p-3 text-xs text-stone-500">
                  {formatDate(u.createdAt)}
                  <br />
                  {u.lastLoginAt ? formatDate(u.lastLoginAt) : "never"}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    {u.role === "teacher" && u.teacherStatus !== "verified" && (
                      <form action={setTeacherStatusAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="verified" />
                        <button type="submit" className="btn-primary min-h-9 px-3 text-xs"><BadgeCheck aria-hidden className="size-4" /> Verify</button>
                      </form>
                    )}
                    {u.role === "teacher" && u.teacherStatus === "pending" && (
                      <form action={setTeacherStatusAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <button type="submit" className="btn-secondary min-h-9 px-3 text-xs"><X aria-hidden className="size-4" /> Reject</button>
                      </form>
                    )}
                    {u.role === "teacher" && u.teacherStatus === "verified" && (
                      <form action={setTeacherStatusAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value="pending" />
                        <button type="submit" className="btn-ghost min-h-9 px-3 text-xs"><RotateCcw aria-hidden className="size-4" /> Revoke</button>
                      </form>
                    )}
                    {u.role !== "admin" && u.id !== admin.id && (
                      <form action={setUserStatusAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
                        {u.status === "active" ? (
                          <ConfirmButton message={`Suspend ${u.email}? They will be signed out everywhere.`} className="btn-ghost min-h-9 px-3 text-xs text-red-700">
                            <Ban aria-hidden className="size-4" /> Suspend
                          </ConfirmButton>
                        ) : (
                          <button type="submit" className="btn-ghost min-h-9 px-3 text-xs">Reactivate</button>
                        )}
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        base="/admin/users"
        params={{ q, role: params.role, queue: queue ? "1" : undefined }}
        page={page}
        pageCount={Math.ceil(total / ADMIN_USERS_PAGE_SIZE)}
      />
    </div>
  );
}
