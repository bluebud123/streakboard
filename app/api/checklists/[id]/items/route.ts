import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const cl = await prisma.checklist.findUnique({ where: { id: params.id }, select: { visibility: true } });
  const isGroup = cl?.visibility === "PRIVATE_COLLAB";

  // For group projects: fetch all users' revisions with username; otherwise only current user's
  const revisionFilter = isGroup
    ? {
        where: { createdAt: { gte: since } },
        select: { createdAt: true, user: { select: { username: true } } },
        orderBy: { createdAt: "desc" as const },
      }
    : {
        where: { userId, createdAt: { gte: since } },
        select: { createdAt: true, user: { select: { username: true } } },
        orderBy: { createdAt: "desc" as const },
      };
  const createdBySelect = { select: { username: true, isPublic: true } };

  const items = await prisma.checklistItem.findMany({
    where: { checklistId: params.id, parentId: null },
    orderBy: { order: "asc" },
    include: {
      progress: { where: { userId } },
      revisions: revisionFilter,
      createdBy: createdBySelect,
      children: {
        orderBy: { order: "asc" },
        include: {
          progress: { where: { userId } },
          revisions: revisionFilter,
          createdBy: createdBySelect,
          children: {
            orderBy: { order: "asc" },
            include: {
              progress: { where: { userId } },
              revisions: revisionFilter,
              createdBy: createdBySelect,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ items });
}
