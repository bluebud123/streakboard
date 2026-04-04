import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import DiscoverClient from "./DiscoverClient";

export const metadata = {
  title: "Explore Projects — Streakboard",
  description: "Browse community study project templates and open collaborative projects.",
};

export default async function DiscoverPage() {
  const session = await auth();

  const projects = await prisma.checklist.findMany({
    where: { visibility: { in: ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"] } },
    include: {
      user: { select: { name: true, username: true } },
      items: { select: { id: true } },
      participants: { select: { userId: true } },
    },
    orderBy: [{ participants: { _count: "desc" } }, { createdAt: "desc" }],
    take: 60,
  });

  const viewerParticipating = session?.user?.id
    ? new Set(projects.filter((p) => p.participants.some((pt) => pt.userId === session.user!.id)).map((p) => p.id))
    : new Set<string>();

  const cards = projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    visibility: p.visibility,
    ownerName: p.user.name,
    ownerUsername: p.user.username,
    itemCount: p.items.length,
    participantCount: p.participants.length,
    isParticipating: viewerParticipating.has(p.id),
    isOwner: session?.user?.id === p.userId,
  }));

  const templates = cards.filter((c) => c.visibility === "PUBLIC_TEMPLATE");
  const open = cards.filter((c) => c.visibility === "PUBLIC_COLLAB" || c.visibility === "PUBLIC_EDIT");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">Streakboard</Link>
        <div className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/signup" className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors">
              Create yours →
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Explore Projects</h1>
          <p className="text-slate-400 text-sm mt-1">
            Copy a community template to your account, or join an open project and track your progress alongside others.
          </p>
        </div>

        {/* Community Templates */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            📋 Community Templates
            <span className="ml-2 text-sm font-normal text-slate-500">({templates.length})</span>
          </h2>

          {templates.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">No public templates yet.</p>
              <p className="text-slate-600 text-xs mt-1">
                Be the first! Create a project on your{" "}
                <Link href={session ? "/dashboard" : "/signup"} className="text-amber-400 hover:text-amber-300">dashboard</Link>
                {" "}and set it to Template visibility.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {templates.map((c) => (
                <DiscoverClient key={c.id} card={c} isLoggedIn={!!session} />
              ))}
            </div>
          )}
        </section>

        {/* Open Projects */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4">
            👥 Open Projects
            <span className="ml-2 text-sm font-normal text-slate-500">({open.length})</span>
          </h2>

          {open.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">No open projects yet.</p>
              <p className="text-slate-600 text-xs mt-1">
                Set a project to <strong className="text-slate-400">Collab</strong> or{" "}
                <strong className="text-slate-400">Open Edit</strong> visibility to appear here.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {open.map((c) => (
                <DiscoverClient key={c.id} card={c} isLoggedIn={!!session} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
