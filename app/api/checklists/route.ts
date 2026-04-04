import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

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
      personalOrders: { where: { userId } },
      children: {
        orderBy: { order: "asc" as const },
        include: {
          progress: { where: { userId } },
          personalOrders: { where: { userId } },
          children: {
            orderBy: { order: "asc" as const },
            include: {
              progress: { where: { userId } },
              personalOrders: { where: { userId } },
            },
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

  const [owned, participating, requests] = await Promise.all([
    prisma.checklist.findMany({
      where: { userId },
      include: {
        items: nestedItemsInclude(userId),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
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
    prisma.projectRequest.findMany({
      where: { requesterId: userId, status: { not: "PENDING" } },
      include: { checklist: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return NextResponse.json({ owned, participating, recentRequests: requests });
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
      data: { checklistId, text, parentId, depth, order: count, createdById: userId },
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

  // ── deleteItem ──────────────────────────────────────────────────────────
  if (action === "deleteItem") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isOwner = item.checklist.userId === userId;
    const isCreator = item.createdById === userId;
    const isParticipant = !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));

    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (isOwner || isCreator) {
      await prisma.checklistItem.delete({ where: { id: itemId } });
      return NextResponse.json({ ok: true, deleted: true });
    } else {
      // Create a request for the creator
      await prisma.projectRequest.create({
        data: {
          type: "DELETE",
          checklistId: item.checklistId,
          itemId: item.id,
          requesterId: userId,
        },
      });
      return NextResponse.json({ ok: true, requested: true });
    }
  }

  // ── reorderItems ──────────────────────────────────────────────────────────
  if (action === "reorderItems") {
    const { checklistId, orderedIds } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = cl.userId === userId;
    const isParticipant = !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (isOwner) {
      await prisma.$transaction(
        (orderedIds as string[]).map((id: string, i: number) =>
          prisma.checklistItem.update({ where: { id }, data: { order: i } })
        )
      );
    } else {
      // Participant: update personal order
      await prisma.$transaction(
        (orderedIds as string[]).map((id: string, i: number) =>
          prisma.checklistPersonalOrder.upsert({
            where: { itemId_userId: { itemId: id, userId } },
            update: { order: i },
            create: { itemId: id, userId, order: i },
          })
        )
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── toggleProgress (kept for public project page) ────────────────────────
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

  // ── checkItem (dashboard — logs revision, marks done) ─────────────────────
  if (action === "checkItem") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = item.checklist.userId === userId;
    const isParticipant =
      !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Always log a revision
    await prisma.checklistRevision.create({ data: { itemId, userId } });

    // Upsert progress as done=true
    await prisma.checklistProgress.upsert({
      where: { itemId_userId: { itemId, userId } },
      update: { done: true, doneAt: new Date() },
      create: { itemId, userId, done: true, doneAt: new Date() },
    });

    const revisionCount = await prisma.checklistRevision.count({ where: { itemId, userId } });
    return NextResponse.json({ done: true, revisionCount });
  }

  // ── uncheckItem (marks not done, no revision) ─────────────────────────────
  if (action === "uncheckItem") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = item.checklist.userId === userId;
    const isParticipant =
      !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.checklistProgress.upsert({
      where: { itemId_userId: { itemId, userId } },
      update: { done: false, doneAt: null },
      create: { itemId, userId, done: false },
    });
    return NextResponse.json({ done: false });
  }

  // ── removeLastRevision (undo accidental check) ────────────────────────────
  if (action === "removeLastRevision") {
    const { itemId } = body;
    const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { checklist: true } });
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = item.checklist.userId === userId;
    const isParticipant = !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const latest = await prisma.checklistRevision.findFirst({
      where: { itemId, userId }, orderBy: { createdAt: "desc" },
    });
    if (latest) await prisma.checklistRevision.delete({ where: { id: latest.id } });

    const remaining = await prisma.checklistRevision.count({ where: { itemId, userId } });
    if (remaining === 0) {
      await prisma.checklistProgress.upsert({
        where: { itemId_userId: { itemId, userId } },
        update: { done: false, doneAt: null },
        create: { itemId, userId, done: false },
      });
    }
    return NextResponse.json({ done: remaining > 0, revisionCount: remaining });
  }

  // ── getSectionProgress (collab leaderboard per section) ───────────────────
  if (action === "getSectionProgress") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({
      where: { id: checklistId },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
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
      },
    });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner = cl.userId === userId;
    const isParticipant =
      !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId, userId } } }));
    if (!isOwner && !isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const ownerUser = await prisma.user.findUnique({ where: { id: cl.userId }, select: { id: true, name: true, username: true } });
    const allParticipants = [
      ...(ownerUser ? [ownerUser] : []),
      ...cl.participants.map((p) => p.user),
    ];

    // Helper: flatten checkable items from a list
    type AnyItem = { id: string; isSection: boolean; progress: { userId: string; done: boolean }[]; children?: AnyItem[] };
    function flatCheckable(items: AnyItem[]): AnyItem[] {
      const r: AnyItem[] = [];
      for (const it of items) {
        if (!it.isSection) r.push(it);
        if (it.children) r.push(...flatCheckable(it.children));
      }
      return r;
    }

    const sections = cl.items
      .filter((it) => it.isSection)
      .map((section) => {
        const checkable = flatCheckable(section.children as AnyItem[]);
        const total = checkable.length;
        const participants = allParticipants.map((u) => ({
          userId: u.id,
          name: u.name,
          username: u.username,
          done: checkable.filter((it) => it.progress.some((p) => p.userId === u.id && p.done)).length,
          total,
        }));
        return { sectionId: section.id, sectionText: section.text, participants };
      });

    // Also overall stats (non-section items included)
    const allCheckable = flatCheckable(cl.items as AnyItem[]);
    const overall = allParticipants.map((u) => ({
      userId: u.id,
      name: u.name,
      username: u.username,
      done: allCheckable.filter((it) => it.progress.some((p) => p.userId === u.id && p.done)).length,
      total: allCheckable.length,
    }));

    return NextResponse.json({ sections, overall });
  }

  // ── renameChecklist ───────────────────────────────────────────────────────
  if (action === "renameChecklist") {
    const { checklistId, name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const updated = await prisma.checklist.update({ where: { id: checklistId }, data: { name: name.trim() } });
    return NextResponse.json(updated);
  }

  // ── changeVisibility ──────────────────────────────────────────────────────
  if (action === "changeVisibility") {
    const { checklistId, visibility } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    let slug = cl.slug;
    if (visibility !== "PRIVATE" && !slug) {
      slug = await uniqueSlug(`${slugify(cl.name)}-${nanoid()}`);
    } else if (visibility === "PRIVATE") {
      slug = null;
    }
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

  // ── handleProjectRequest ──────────────────────────────────────────────────
  if (action === "handleProjectRequest") {
    const { requestId, status, message } = body;
    const request = await prisma.projectRequest.findUnique({
      where: { id: requestId },
      include: { checklist: true },
    });
    if (!request || request.checklist.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status === "APPROVED") {
      if (request.type === "DELETE" && request.itemId) {
        await prisma.checklistItem.delete({ where: { id: request.itemId } });
      }
      await prisma.projectRequest.delete({ where: { id: requestId } });
    } else {
      await prisma.projectRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", message: message || "Request denied by owner" },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
