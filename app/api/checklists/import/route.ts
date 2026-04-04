import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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
    const checklist = await prisma.checklist.create({
      data: { userId: session.user.id, name: parsed.name },
    });

    // Create items hierarchically
    await createTree(checklist.id, parsed.tree, null, 0);

    // Return the full checklist with root items + children
    const full = await prisma.checklist.findUnique({
      where: { id: checklist.id },
      include: {
        items: {
          where: { parentId: null },
          orderBy: { order: "asc" },
          include: {
            progress: { where: { userId: session.user.id } },
            children: {
              orderBy: { order: "asc" },
              include: {
                progress: { where: { userId: session.user.id } },
                children: {
                  orderBy: { order: "asc" },
                  include: { progress: { where: { userId: session.user.id } } },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Import failed — please try again" }, { status: 500 });
  }
}

function countItems(nodes: ParsedNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countItems(n.children), 0);
}
