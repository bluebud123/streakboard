import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import DiscoverList from "./DiscoverList";

export const metadata = {
  title: "Explore Projects — Streakboard",
  description: "Browse community study project templates and open collaborative projects.",
};

export default async function DiscoverPage() {
  const session = await auth();

  const projects = await prisma.checklist.findMany({
    where: { visibility: { in: ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"] } },
    select: {
      id: true,
      name: true,
      description: true,
      slug: true,
      visibility: true,
      userId: true,
      createdAt: true,
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
    description: p.description,
    slug: p.slug,
    visibility: p.visibility,
    ownerName: p.user.name,
    ownerUsername: p.user.username,
    itemCount: p.items.length,
    participantCount: p.participants.length,
    isParticipating: viewerParticipating.has(p.id),
    isOwner: session?.user?.id === p.userId,
  }));

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

        <DiscoverList cards={cards} isLoggedIn={!!session} />
      </main>
    </div>
  );
}
