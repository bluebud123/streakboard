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
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-fadeIn">
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md transition-all duration-200">
        <Link href={session ? "/dashboard" : "/"} className="text-xl font-bold text-amber-500 hover:text-amber-400 transition-colors tracking-tight">Streakboard</Link>
        <div className="flex items-center gap-5">
          {session ? (
            <>
              <Link href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-amber-400 after:transition-all after:duration-200">
                Dashboard
              </Link>
              <Link href="/logs" className="text-sm text-slate-400 hover:text-white transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-amber-400 after:transition-all after:duration-200">
                Log
              </Link>
            </>
          ) : (
            <Link href="/signup" className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/20">
              Create yours →
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        <div className="px-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Explore Projects</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-xl">
            Copy a community template to your account, or join an open project and track your progress alongside others.
          </p>
        </div>

        <DiscoverList cards={cards} isLoggedIn={!!session} />
      </main>
    </div>
  );
}
