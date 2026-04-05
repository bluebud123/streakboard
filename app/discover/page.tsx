import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
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
      likes: { select: { userId: true, type: true } },
    },
    orderBy: [{ likes: { _count: "desc" } }, { participants: { _count: "desc" } }, { createdAt: "desc" }],
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
    likeCount: p.likes.filter((l) => l.type === "LIKE").length,
    dislikeCount: p.likes.filter((l) => l.type === "DISLIKE").length,
    myVote: session?.user?.id ? (p.likes.find((l) => l.userId === session.user!.id)?.type ?? null) : null,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 animate-fadeIn">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-12 space-y-12">
        <div className="px-1">
          <h1 className="text-3xl font-black text-white tracking-tight">Explore Projects</h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-xl">
            Browse community templates, join open projects, and track your progress alongside others.
          </p>
        </div>
        <DiscoverList cards={cards} isLoggedIn={!!session} />
      </main>
    </div>
  );
}
