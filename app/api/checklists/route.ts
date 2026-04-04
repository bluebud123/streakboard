import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (await prisma.checklist.findUnique({ where: { slug } })) slug = `${base}-${i++}`;
  return slug;
}

// Helper: nested items include (2 levels deep)
function nestedItemsInclude(userId: string) {
  return {
    where: { parentId: null },
    orderBy: { order: "asc" as const },
    include: {
      progress: { where: { userId } },
      children: {
        orderBy: { order: "asc" as const },
        include: {
          progress: { where: { userId } },
          children: {
            orderBy: { order: "asc" as const },
            include: { progress: { where: { userId } } },
          },
        },
      },
    },
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [owned, participating] = await Promise.all([
    prisma.checklist.findMany({
      where: { userId },
      include: {
        items: nestedItemsInclude(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.checklist.findMany({
      where: { participants: { some: { userId } }, userId: { not: userId } },
      include: {
        user: { select: { name: true, username: true } },
        items: nestedItemsInclude(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ owned, participating });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const checklist = await prisma.checklist.create({
    data: { userId: session.user.id, name, description: description || null },
    include: { items: nestedItemsInclude(session.user.id) },
  });

  return NextResponse.json(checklist, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();
  const { action } = body;

  // ── addItem ───────────────────────────────────────────────────────────────
  if (action === "addItem") {
    const { checklistId, text, parentId = null, depth = 1 } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canEdit =
      cl.userId === userId ||
      (cl.visibility === "PUBLIC_EDIT" &&
        !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId, userId } } })));
    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const count = await prisma.checklistItem.count({ where: { checklistId, parentId } });
    const item = await prisma.checklistItem.create({
      data: { checklistId, text, parentId, depth, order: count },
    });
    return NextResponse.json(item);
  }

  // ── renameItem ────────────────────────────────────────────────────────────
  if (action === "renameItem") {
    const { itemId, text } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canEdit =
      item.checklist.userId === userId ||
      (item.checklist.visibility === "PUBLIC_EDIT" &&
        !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } })));
    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.checklistItem.update({ where: { id: itemId }, data: { text } });
    return NextResponse.json(updated);
  }

  // ── deleteItem ────────────────────────────────────────────────────────────
  if (action === "deleteItem") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canEdit =
      item.checklist.userId === userId ||
      (item.checklist.visibility === "PUBLIC_EDIT" &&
        !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } })));
    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklistItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true });
  }

  // ── reorderItems ──────────────────────────────────────────────────────────
  if (action === "reorderItems") {
    const { checklistId, orderedIds } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const canEdit =
      cl.userId === userId ||
      (cl.visibility === "PUBLIC_EDIT" &&
        !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId, userId } } })));
    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.$transaction(
      (orderedIds as string[]).map((id: string, i: number) =>
        prisma.checklistItem.update({ where: { id }, data: { order: i } })
      )
    );
    return NextResponse.json({ ok: true });
  }

  // ── toggleProgress ────────────────────────────────────────────────────────
  if (action === "toggleProgress") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = item.checklist.userId === userId;
    const isParticipant =
      !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const existing = await prisma.checklistProgress.findUnique({ where: { itemId_userId: { itemId, userId } } });
    if (existing) {
      const updated = await prisma.checklistProgress.update({
        where: { itemId_userId: { itemId, userId } },
        data: { done: !existing.done, doneAt: !existing.done ? new Date() : null },
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.checklistProgress.create({
        data: { itemId, userId, done: true, doneAt: new Date() },
      });
      return NextResponse.json(created);
    }
  }

  // ── changeVisibility ──────────────────────────────────────────────────────
  if (action === "changeVisibility") {
    const { checklistId, visibility } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let slug = cl.slug;
    if (visibility !== "PRIVATE" && !slug) slug = await uniqueSlug(slugify(cl.name));
    const updated = await prisma.checklist.update({ where: { id: checklistId }, data: { visibility, slug } });
    return NextResponse.json(updated);
  }

  // ── join ──────────────────────────────────────────────────────────────────
  if (action === "join") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId === userId) return NextResponse.json({ error: "Cannot join own project" }, { status: 400 });
    if (cl.visibility === "PRIVATE" || cl.visibility === "PUBLIC_TEMPLATE") {
      return NextResponse.json({ error: "Not open for collaboration" }, { status: 403 });
    }
    const p = await prisma.checklistParticipant.upsert({
      where: { checklistId_userId: { checklistId, userId } },
      update: {},
      create: { checklistId, userId },
    });
    return NextResponse.json(p);
  }

  // ── copyTemplate ──────────────────────────────────────────────────────────
  if (action === "copyTemplate") {
    const { checklistId } = body;
    const original = await prisma.checklist.findUnique({
      where: { id: checklistId },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { order: "asc" },
          include: {
            children: {
              orderBy: { order: "asc" },
              include: { children: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    });
    if (!original || (original.visibility === "PRIVATE" && original.userId !== userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const copy = await prisma.checklist.create({
      data: { userId, name: `${original.name} (copy)`, description: original.description, templateOf: original.id },
    });

    // Recursively copy items preserving hierarchy
    type CopyItem = { text: string; isSection: boolean; depth: number; order: number; children?: CopyItem[] };
    async function copyItems(items: CopyItem[], parentId: string | null) {
      for (const item of items) {
        const created = await prisma.checklistItem.create({
          data: {
            checklistId: copy.id,
            parentId,
            text: item.text,
            isSection: item.isSection,
            depth: item.depth,
            order: item.order,
          },
        });
        if (item.children?.length) await copyItems(item.children, created.id);
      }
    }
    await copyItems(original.items as CopyItem[], null);

    const full = await prisma.checklist.findUnique({
      where: { id: copy.id },
      include: { items: nestedItemsInclude(userId) },
    });
    return NextResponse.json(full);
  }

  // ── delete ────────────────────────────────────────────────────────────────
  if (action === "delete") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklist.delete({ where: { id: checklistId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
