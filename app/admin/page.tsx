import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!currentUser?.isAdmin) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      studyingFor: true,
      isAdmin: true,
      isPublic: true,
      createdAt: true,
      _count: { select: { checklists: true, checkIns: true } },
      checkIns: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
    },
  });

  const [checklistCount, userCount, checkInCount] = await Promise.all([
    prisma.checklist.count(),
    prisma.user.count(),
    prisma.checkIn.count(),
  ]);

  const anonymousSetting = await prisma.siteSetting.findUnique({ where: { key: "anonymousGraphs" } });

  const userData = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    studyingFor: u.studyingFor,
    isAdmin: u.isAdmin,
    isPublic: u.isPublic,
    createdAt: u.createdAt.toISOString(),
    projectCount: u._count.checklists,
    checkInCount: u._count.checkIns,
    lastCheckIn: u.checkIns[0]?.date ?? null,
  }));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-amber-500 font-medium px-2 py-0.5 bg-amber-500/10 rounded-full">Admin</span>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Admin Panel</h1>
          <p className="text-slate-400 text-sm mt-1">Manage users and site settings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total users", value: userCount },
            { label: "Total projects", value: checklistCount },
            { label: "Total check-ins", value: checkInCount },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-amber-400">{stat.value}</p>
              <p className="text-slate-400 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <AdminClient
          users={userData}
          anonymousGraphs={anonymousSetting?.value === "true"}
          currentAdminId={session.user.id}
        />
      </main>
    </div>
  );
}
