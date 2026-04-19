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

// Helper: nested items include (2 levels deep).
// When `shared` is true (PRIVATE_COLLAB), fetches ALL participants' progress
// with user names so the UI can show one shared progress and "done by @name".
function nestedItemsInclude(userId: string, shared = false) {
  const progressInclude = shared
    ? { include: { user: { select: { id: true, name: true, username: true } } } }
    : { where: { userId } };
  return {
    where: { parentId: null },
    orderBy: { order: "asc" as const },
    include: {
      progress: progressInclude,
      personalOrders: { where: { userId } },
      children: {
        orderBy: { order: "asc" as const },
        include: {
          progress: progressInclude,
          personalOrders: { where: { userId } },
          children: {
            orderBy: { order: "asc" as const },
            include: {
              progress: progressInclude,
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
        items: nestedItemsInclude(userId, true),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.checklist.findMany({
      where: { participants: { some: { userId } }, userId: { not: userId } },
      include: {
        user: { select: { name: true, username: true } },
        items: nestedItemsInclude(userId, true),
        participants: { include: { user: { select: { id: true, name: true, username: true } } } },
        // Include viewer's own pending edit request to surface "Edit request pending"
        requests: { where: { requesterId: userId, type: "EDIT", status: "PENDING" }, select: { id: true, status: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectRequest.findMany({
      where: { requesterId: userId, status: { not: "PENDING" }, dismissedAt: null },
      include: { checklist: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // Lazy slug backfill: ensure every public project has a slug for share links.
  const allChecklists = [...owned, ...participating.map((p: { id: string; name: string; slug: string | null; visibility: string }) => p)];
  const needSlug = allChecklists.filter(
    (cl) => !cl.slug && cl.visibility !== "PRIVATE" && cl.visibility !== "PRIVATE_COLLAB"
  );
  if (needSlug.length > 0) {
    await Promise.all(
      needSlug.map(async (cl) => {
        const slug = await uniqueSlug(`${slugify(cl.name)}-${nanoid()}`);
        await prisma.checklist.update({ where: { id: cl.id }, data: { slug } });
        // Patch the in-memory object so the response includes the slug.
        (cl as Record<string, unknown>).slug = slug;
      })
    );
  }

  // Post-process items: for PRIVATE_COLLAB, expose sharedProgress (all members)
  // and rewrite progress to a single entry indicating "anyone done".
  // For everything else, narrow progress to current user's own record.
  type AnyItem = { progress: Array<{ userId: string; done: boolean; user?: { id: string; name: string; username: string } }>; children?: AnyItem[]; sharedProgress?: unknown };
  function transformItems(items: AnyItem[], shared: boolean): AnyItem[] {
    return items.map((it) => {
      const all = it.progress || [];
      if (shared) {
        const anyDone = all.some((p) => p.done);
        return {
          ...it,
          sharedProgress: all.filter((p) => p.done && p.user).map((p) => ({ userId: p.userId, name: p.user!.name, username: p.user!.username })),
          progress: anyDone ? [{ userId, done: true }] : [],
          children: it.children ? transformItems(it.children, shared) : [],
        };
      }
      return {
        ...it,
        progress: all.filter((p) => p.userId === userId),
        children: it.children ? transformItems(it.children, shared) : [],
      };
    });
  }
  type AnyChecklist = { visibility: string; items: AnyItem[] };
  for (const cl of [...owned, ...participating] as AnyChecklist[]) {
    cl.items = transformItems(cl.items, cl.visibility === "PRIVATE_COLLAB");
  }

  // Expose viewer's own canEdit per participating checklist
  type ParticipatingShape = { id: string; participants: { userId: string; canEdit?: boolean }[]; viewerCanEdit?: boolean };
  for (const cl of participating as unknown as ParticipatingShape[]) {
    const me = cl.participants.find((p) => p.userId === userId);
    cl.viewerCanEdit = !!me?.canEdit;
  }

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
    const part = await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId, userId } } });
    const canEdit = cl.userId === userId || (!!part && part.canEdit);
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
    const part = await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } });
    const canEdit = item.checklist.userId === userId || (!!part && part.canEdit);
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
    const part = await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } });
    const canEdit = isOwner || (!!part && part.canEdit);

    if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.checklistItem.delete({ where: { id: itemId } });
    return NextResponse.json({ ok: true, deleted: true });
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
    const isPublicProject = ["PUBLIC_TEMPLATE", "PUBLIC_COLLAB", "PUBLIC_EDIT"].includes(item.checklist.visibility);
    const isParticipant =
      !isOwner &&
      !!(await prisma.checklistParticipant.findUnique({ where: { checklistId_userId: { checklistId: item.checklistId, userId } } }));
    // Allow any logged-in user to toggle progress on public projects (personal tracking)
    if (!isOwner && !isParticipant && !isPublicProject) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    const isPrivateType = visibility === "PRIVATE" || visibility === "PRIVATE_COLLAB";
    if (!isPrivateType && !slug) {
      slug = await uniqueSlug(`${slugify(cl.name)}-${nanoid()}`);
    } else if (isPrivateType) {
      slug = null;
    }
    const updated = await prisma.checklist.update({ where: { id: checklistId }, data: { visibility, slug } });
    return NextResponse.json(updated);
  }

  // ── requestJoin (replaces instant join — requires creator approval) ─────
  // Request EDIT access (after joining as participant). Owner approves to grant edit.
  if (action === "requestEdit" || action === "requestJoin") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId === userId) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
    if (cl.visibility !== "PUBLIC_COLLAB" && cl.visibility !== "PUBLIC_EDIT") {
      return NextResponse.json({ error: "Not open for edit requests" }, { status: 403 });
    }
    // Must be a participant first
    const existing = await prisma.checklistParticipant.findUnique({
      where: { checklistId_userId: { checklistId, userId } },
    });
    if (!existing) return NextResponse.json({ error: "Join the project first" }, { status: 400 });
    if (existing.canEdit) return NextResponse.json({ ok: true, alreadyApproved: true });
    // Check for pending request (max 1 pending per user per project)
    const pending = await prisma.projectRequest.findFirst({
      where: { checklistId, requesterId: userId, type: "EDIT", status: "PENDING" },
    });
    if (pending) return NextResponse.json({ ok: true, alreadyRequested: true });
    // Rate limit: max 1 request per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequest = await prisma.projectRequest.findFirst({
      where: { checklistId, requesterId: userId, type: "EDIT", status: { not: "PENDING" }, createdAt: { gte: oneDayAgo } },
    });
    if (recentRequest) return NextResponse.json({ error: "You can only request once per day. Please try again later." }, { status: 429 });
    // Create the request. Owner sees it on their next dashboard visit via
    // the in-app notification bell / project requests block — no email sent
    // (keeps Resend free-tier headroom for higher-priority messages).
    await prisma.projectRequest.create({
      data: { type: "EDIT", checklistId, requesterId: userId },
    });

    return NextResponse.json({ ok: true, requested: true });
  }

  // ── join (kept for backward compat — used by import/ortho flow) ─────────
  if (action === "join") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId === userId) return NextResponse.json({ error: "Cannot join own project" }, { status: 400 });
    if (cl.visibility === "PRIVATE" || cl.visibility === "PRIVATE_COLLAB" || cl.visibility === "PUBLIC_TEMPLATE") {
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

  // ── archiveProject ────────────────────────────────────────────────────────
  if (action === "archiveProject") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklist.update({ where: { id: checklistId }, data: { archivedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  // ── unarchiveProject ──────────────────────────────────────────────────────
  if (action === "unarchiveProject") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklist.update({ where: { id: checklistId }, data: { archivedAt: null } });
    return NextResponse.json({ ok: true });
  }

  // ── setDeadline ───────────────────────────────────────────────────────────
  if (action === "setDeadline") {
    const { checklistId, deadline } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklist.update({
      where: { id: checklistId },
      data: { deadline: deadline ? new Date(deadline) : null },
    });
    return NextResponse.json({ ok: true });
  }

  // ── reorderProjects ───────────────────────────────────────────────────────
  if (action === "reorderProjects") {
    const { ids } = body;
    if (!Array.isArray(ids)) return NextResponse.json({ error: "ids required" }, { status: 400 });
    await prisma.$transaction(
      (ids as string[]).map((id: string, i: number) =>
        prisma.checklist.updateMany({ where: { id, userId }, data: { order: i } })
      )
    );
    return NextResponse.json({ ok: true });
  }

  // ── inviteMember (PRIVATE_COLLAB) ─────────────────────────────────────────
  if (action === "inviteMember") {
    const { checklistId, username } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const invitee = await prisma.user.findUnique({ where: { username } });
    if (!invitee) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const p = await prisma.checklistParticipant.upsert({
      where: { checklistId_userId: { checklistId, userId: invitee.id } },
      update: {},
      create: { checklistId, userId: invitee.id },
    });
    return NextResponse.json(p);
  }

  // ── removeMember (PRIVATE_COLLAB) ─────────────────────────────────────────
  if (action === "removeMember") {
    const { checklistId, memberId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl || cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.checklistParticipant.deleteMany({ where: { checklistId, userId: memberId } });
    return NextResponse.json({ ok: true });
  }

  // ── leaveProject (participant self-remove) ────────────────────────────────
  if (action === "leaveProject") {
    const { checklistId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId } });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cl.userId === userId) {
      return NextResponse.json({ error: "Owners cannot leave — delete or archive instead" }, { status: 400 });
    }
    // Collect this user's checkboxes + review dates on this project so we can
    // clean them up at the same time — leaving should be a clean exit.
    const items = await prisma.checklistItem.findMany({
      where: { checklistId },
      select: { id: true },
    });
    const itemIds = items.map((i) => i.id);
    await prisma.$transaction([
      prisma.checklistParticipant.deleteMany({ where: { checklistId, userId } }),
      prisma.checklistProgress.deleteMany({ where: { userId, itemId: { in: itemIds } } }),
      prisma.checklistRevision.deleteMany({ where: { userId, itemId: { in: itemIds } } }),
      prisma.checklistPersonalOrder.deleteMany({ where: { userId, itemId: { in: itemIds } } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  // ── revokeEdit (owner removes edit access from a participant) ────────────
  // Sets canEdit=false — participant stays in the project (can still view +
  // track personal progress) but loses write access to the checklist tree.
  if (action === "revokeEdit") {
    const { checklistId, participantUserId } = body;
    const cl = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { userId: true } });
    if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cl.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (participantUserId === userId) {
      return NextResponse.json({ error: "Owner always has edit access" }, { status: 400 });
    }
    const updated = await prisma.checklistParticipant.updateMany({
      where: { checklistId, userId: participantUserId },
      data: { canEdit: false },
    });
    // Also clear any lingering PENDING edit requests so the requester's
    // "pending" badge doesn't get stuck after a revoke+re-request cycle.
    await prisma.projectRequest.updateMany({
      where: { checklistId, requesterId: participantUserId, type: "EDIT", status: "PENDING" },
      data: { status: "REJECTED", message: "Edit access revoked by owner" },
    });
    return NextResponse.json({ ok: true, revoked: updated.count });
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
      if (request.type === "JOIN") {
        // Legacy: add requester as participant (with edit) for old approval flow
        await prisma.checklistParticipant.upsert({
          where: { checklistId_userId: { checklistId: request.checklistId, userId: request.requesterId } },
          update: { canEdit: true },
          create: { checklistId: request.checklistId, userId: request.requesterId, canEdit: true },
        });
      }
      if (request.type === "EDIT") {
        // Grant edit access to existing participant
        await prisma.checklistParticipant.upsert({
          where: { checklistId_userId: { checklistId: request.checklistId, userId: request.requesterId } },
          update: { canEdit: true },
          create: { checklistId: request.checklistId, userId: request.requesterId, canEdit: true },
        });
      }
      // Mark approved (kept so requester sees the notification), don't delete
      await prisma.projectRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });
    } else {
      await prisma.projectRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED", message: message || "Request denied by owner" },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ── dismissRequest (requester clears a resolved notification) ──────────────
  if (action === "dismissRequest") {
    const { requestId, all } = body;
    if (all) {
      await prisma.projectRequest.updateMany({
        where: { requesterId: userId, status: { not: "PENDING" }, dismissedAt: null },
        data: { dismissedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }
    const req = await prisma.projectRequest.findUnique({ where: { id: requestId } });
    if (!req || req.requesterId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.projectRequest.update({ where: { id: requestId }, data: { dismissedAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
