import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import PublicProjectClient from "./PublicProjectClient";

// Flatten a nested item tree to get all checkable (non-section) items
type NestedItem = {
  id: string;
  text: string;
  order: number;
  isSection: boolean;
  depth: number;
  progress: { userId: string; done: boolean }[];
  children?: NestedItem[];
};

function flattenCheckable(items: NestedItem[]): NestedItem[] {
  const result: NestedItem[] = [];
  for (const item of items) {
    if (!item.isSection) result.push(item);
    for (const child of item.children ?? []) {
      if (!child.isSection) result.push(child);
      for (const sub of child.children ?? []) {
        if (!sub.isSection) result.push(sub);
      }
    }
  }
  return result;
}

export interface TreeItem {
  id: string;
  text: string;
  order: number;
  isSection: boolean;
  depth: number;
  doneCount: number;
  totalParticipants: number;
  myDone: boolean;
  children: TreeItem[];
}

function mapToTree(
  item: NestedItem,
  participantIds: string[],
  viewerUserId: string | null,
  totalParticipants: number
): TreeItem {
  const checkable = !item.isSection;
  return {
    id: item.id,
    text: item.text,
    order: item.order,
    isSection: item.isSection,
    depth: item.depth,
    doneCount: checkable
      ? item.progress.filter((p) => p.done && participantIds.includes(p.userId)).length
      : 0,
    totalParticipants,
    myDone:
      checkable && viewerUserId
        ? (item.progress.find((p) => p.userId === viewerUserId)?.done ?? false)
        : false,
    children: (item.children ?? []).map((c) =>
      mapToTree(c, participantIds, viewerUserId, totalParticipants)
    ),
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const viewerUserId = session?.user?.id ?? null;

  const cl = await prisma.checklist.findUnique({
    where: { slug },
    include: {
      user: { select: { name: true, username: true } },
      items: {
        where: { parentId: null },
        orderBy: { order: "asc" },
        include: {
          progress: { select: { userId: true, done: true } },
          children: {
            orderBy: { order: "asc" },
            include: {
              progress: { select: { userId: true, done: true } },
              children: {
                orderBy: { order: "asc" },
                include: { progress: { select: { userId: true, done: true } } },
              },
            },
          },
        },
      },
      participants: {
        include: { user: { select: { id: true, name: true, username: true } } },
      },
    },
  });

  if (!cl || cl.visibility === "PRIVATE") notFound();

  const isOwner = viewerUserId === cl.userId;
  const isParticipant = isOwner || cl.participants.some((p) => p.user.id === viewerUserId);

  const participantIds = [cl.userId, ...cl.participants.map((p) => p.user.id)];
  const ownerUser = await prisma.user.findUnique({
    where: { id: cl.userId },
    select: { id: true, name: true, username: true },
  });

  const allParticipants = [
    ...(ownerUser ? [{ user: ownerUser, isOwner: true }] : []),
    ...cl.participants.map((p) => ({ user: p.user, isOwner: false })),
  ];

  // Flatten for leaderboard stats (only checkable items count)
  const flatCheckable = flattenCheckable(cl.items as NestedItem[]);
  const totalCheckable = flatCheckable.length;

  const leaderboard = allParticipants
    .map(({ user, isOwner: isOwnerFlag }) => {
      const done = flatCheckable.filter((it) =>
        it.progress.some((pr) => pr.userId === user.id && pr.done)
      ).length;
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        done,
        total: totalCheckable,
        isOwner: isOwnerFlag,
      };
    })
    .sort((a, b) => b.done - a.done);

  const treeItems: TreeItem[] = (cl.items as NestedItem[]).map((item) =>
    mapToTree(item, participantIds, viewerUserId, allParticipants.length)
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-400">
          Streakboard
        </Link>
        {!session ? (
          <Link
            href="/signup"
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Create yours →
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Dashboard
          </Link>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{cl.name}</h1>
              {cl.description && (
                <p className="text-slate-400 text-sm mt-1">{cl.description}</p>
              )}
              <p className="text-slate-500 text-xs mt-2">
                by{" "}
                <Link
                  href={`/u/${cl.user.username}`}
                  className="text-slate-400 hover:text-slate-200"
                >
                  @{cl.user.username}
                </Link>
                {" · "}
                {totalCheckable} tasks
                {" · "}
                <span
                  className={`${
                    cl.visibility === "PUBLIC_EDIT" ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {cl.visibility === "PUBLIC_TEMPLATE" && "Template"}
                  {cl.visibility === "PUBLIC_COLLAB" && "Collaboration"}
                  {cl.visibility === "PUBLIC_EDIT" && "Open Edit"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <PublicProjectClient
          checklistId={cl.id}
          visibility={cl.visibility}
          items={treeItems}
          leaderboard={leaderboard}
          isOwner={isOwner}
          isParticipant={isParticipant}
          viewerUserId={viewerUserId}
          isLoggedIn={!!session}
        />
      </main>
    </div>
  );
}
