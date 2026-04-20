import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// Dashboard caches getArchivedChecklists() and getRecentRequests() with tag
// `checklists:${userId}`. Importing creates a new checklist so we must bust
// the cache — otherwise router.refresh() (e.g. from the tab-focus listener
// in ChecklistSection) serves stale data and the dashboard can crash when
// the client state references a checklist the RSC payload doesn't have.
function bustChecklists(userId: string) {
  try { revalidateTag(`checklists:${userId}`); } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedNode {
  text: string;
  isSection: boolean;
  depth: number; // 0 = section header, 1 = task, 2 = subtask
  children: ParsedNode[];
}

// ─── Markdown Parser ─────────────────────────────────────────────────────────

function parseMarkdown(content: string): { name: string; tree: ParsedNode[] } {
  const lines = content.split(/\r?\n/);
  let name = "Imported Project";
  const tree: ParsedNode[] = [];

  let lastSection: ParsedNode | null = null;
  let lastTask: ParsedNode | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    // # Title → project name
    const h1 = line.match(/^#(?!#)\s+(.+)/);
    if (h1) { name = h1[1].trim(); continue; }

    // ## Section → non-checkable group header (depth 0)
    const h2 = line.match(/^##(?!#)\s+(.+)/);
    if (h2) {
      const node: ParsedNode = { text: h2[1].trim(), isSection: true, depth: 0, children: [] };
      tree.push(node);
      lastSection = node;
      lastTask = null;
      continue;
    }

    // ### Sub-section or task → depth 1 item
    const h3 = line.match(/^###(?!#)\s+(.+)/);
    if (h3) {
      const node: ParsedNode = { text: h3[1].trim(), isSection: false, depth: 1, children: [] };
      if (lastSection) { lastSection.children.push(node); } else { tree.push(node); }
      lastTask = node;
      continue;
    }

    // #### Sub-sub heading → depth 2 subtask
    const h4 = line.match(/^####\s+(.+)/);
    if (h4) {
      const node: ParsedNode = { text: h4[1].trim(), isSection: false, depth: 2, children: [] };
      if (lastTask) { lastTask.children.push(node); }
      else if (lastSection) { lastSection.children.push(node); }
      else { tree.push(node); }
      continue;
    }

    // - [ ] item, - [x] item, - item, * item, 1. item
    const item = line.match(/^(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)/);
    if (item) {
      const text = item[1].trim();
      if (!text) continue;
      // Detect indentation (2+ leading spaces = subtask)
      const indent = raw.match(/^(\s+)/)?.[1].length ?? 0;
      if (indent >= 2 && lastTask) {
        lastTask.children.push({ text, isSection: false, depth: 2, children: [] });
      } else {
        const node: ParsedNode = { text, isSection: false, depth: 1, children: [] };
        if (lastSection) { lastSection.children.push(node); } else { tree.push(node); }
        lastTask = node;
      }
    }
  }

  return { name, tree };
}

function parsePlainText(content: string): { name: string; tree: ParsedNode[] } {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || "Imported Project";
  const tree: ParsedNode[] = lines
    .slice(1, 200)
    .map((text) => ({ text, isSection: false, depth: 0, children: [] }));
  return { name, tree };
}

// ─── DB Writer ────────────────────────────────────────────────────────────────

async function createTree(
  checklistId: string,
  nodes: ParsedNode[],
  parentId: string | null,
  orderStart: number
): Promise<number> {
  let order = orderStart;
  for (const node of nodes) {
    const created = await prisma.checklistItem.create({
      data: {
        checklistId,
        parentId,
        text: node.text,
        isSection: node.isSection,
        depth: node.depth,
        order: order++,
      },
    });
    if (node.children.length > 0) {
      await createTree(checklistId, node.children, created.id, 0);
    }
  }
  return order;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["md", "txt"].includes(ext ?? "")) {
      return NextResponse.json({ error: "Only .md and .txt files supported" }, { status: 400 });
    }

    const content = await file.text();
    const parsed = ext === "md" ? parseMarkdown(content) : parsePlainText(content);

    const totalItems = countItems(parsed.tree);
    if (totalItems === 0) {
      return NextResponse.json({ error: "No items found in file" }, { status: 400 });
    }

    // Create the checklist shell first
    let ownerId = session.user.id;
    let visibility = "PRIVATE";
    const isOrtho = file.name === "orthopaedic-surgery.md";

    // Shared include used for the response
    const fullInclude = {
      items: {
        where: { parentId: null },
        orderBy: { order: "asc" as const },
        include: {
          progress: { where: { userId: session.user.id } },
          revisions: { where: { userId: session.user.id }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
          children: {
            orderBy: { order: "asc" as const },
            include: {
              progress: { where: { userId: session.user.id } },
              revisions: { where: { userId: session.user.id }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
              children: {
                orderBy: { order: "asc" as const },
                include: {
                  progress: { where: { userId: session.user.id } },
                  revisions: { where: { userId: session.user.id }, select: { createdAt: true }, orderBy: { createdAt: "desc" as const } },
                },
              },
            },
          },
        },
      },
      user: { select: { id: true, username: true, name: true, isPublic: true } },
      participants: { include: { user: { select: { id: true, username: true, name: true } } } },
      requests: { where: { status: "PENDING" }, include: { requester: { select: { name: true, username: true } } } },
    };

    // ── Special case: Orthopaedic Surgery Fellowship Exam ─────────────────────
    // Instead of creating a brand new checklist on every import, use a single
    // canonical @blue-owned checklist and add the caller as a participant.
    // This lets all users share one leaderboard and prevents duplicates.
    if (isOrtho) {
      const blue = await prisma.user.findUnique({ where: { username: "blue" } });
      if (blue) {
        // Look for an existing canonical Ortho checklist owned by @blue.
        const canonical = await prisma.checklist.findFirst({
          where: { userId: blue.id, name: parsed.name },
          orderBy: { createdAt: "asc" },
        });

        if (canonical) {
          // Enforce PUBLIC_EDIT + slug so leaderboard and share links work.
          const needsUpdate =
            canonical.visibility !== "PUBLIC_EDIT" || !canonical.slug;
          if (needsUpdate) {
            const slug =
              canonical.slug ||
              `${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${canonical.id.slice(-6)}`;
            await prisma.checklist.update({
              where: { id: canonical.id },
              data: { visibility: "PUBLIC_EDIT", slug },
            });
          }

          // Check if the caller is already a participant (or owner).
          const isOwner = canonical.userId === session.user.id;
          const existingParticipant = await prisma.checklistParticipant.findUnique({
            where: { checklistId_userId: { checklistId: canonical.id, userId: session.user.id } },
          });

          let alreadyJoined = false;
          if (isOwner || existingParticipant) {
            alreadyJoined = true;
          } else {
            await prisma.checklistParticipant.create({
              data: { checklistId: canonical.id, userId: session.user.id },
            });
          }

          const full = await prisma.checklist.findUnique({
            where: { id: canonical.id },
            include: fullInclude,
          });
          bustChecklists(session.user.id);
          // Round-trip through JSON.stringify so all Date objects (createdAt,
          // deadline, revisions[].createdAt, etc.) become ISO strings before
          // the client consumes them. Avoids flight-serialization edge cases.
          const safe = JSON.parse(JSON.stringify(full));
          return NextResponse.json({ ...safe, alreadyJoined }, { status: 200 });
        }

        // No canonical yet — create one single time, owned by @blue.
        ownerId = blue.id;
        visibility = "PUBLIC_EDIT";
      }
    }

    const checklist = await prisma.checklist.create({
      data: { userId: ownerId, name: parsed.name, visibility },
    });

    // If we changed the owner, add the current user as a participant so it shows up in their dashboard
    if (isOrtho && ownerId !== session.user.id) {
      await prisma.checklistParticipant.create({
        data: { checklistId: checklist.id, userId: session.user.id },
      });
    }

    // Create items hierarchically
    await createTree(checklist.id, parsed.tree, null, 0);

    // Return the full checklist with root items + children
    const full = await prisma.checklist.findUnique({
      where: { id: checklist.id },
      include: fullInclude,
    });

    bustChecklists(session.user.id);
    // Round-trip through JSON so the response is pure strings/primitives
    // (no Date instances). Matches what the dashboard sends to the client.
    const safe = JSON.parse(JSON.stringify(full));
    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Import failed — please try again" }, { status: 500 });
  }
}

function countItems(nodes: ParsedNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countItems(n.children), 0);
}
