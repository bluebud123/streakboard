import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

interface ParsedItem {
  text: string;
  order: number;
}

function parseMarkdown(content: string): { name: string; items: ParsedItem[] } {
  const lines = content.split(/\r?\n/);
  let name = "Imported Checklist";
  let currentSection = "";
  const items: ParsedItem[] = [];

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) { name = h1[1].trim(); continue; }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { currentSection = h2[1].trim(); continue; }

    // Match: - [ ] text, - [x] text, - text, * text, * [ ] text
    const item = line.match(/^[-*]\s+(?:\[[ xX]\]\s+)?(.+)/);
    if (item) {
      const text = item[1].trim();
      if (!text) continue;
      const full = currentSection ? `[${currentSection}] ${text}` : text;
      items.push({ text: full, order: items.length });
      if (items.length >= 200) break;
    }
  }

  return { name, items };
}

function parsePlainText(content: string): { name: string; items: ParsedItem[] } {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const name = lines[0] || "Imported Checklist";
  const items: ParsedItem[] = lines
    .slice(1)
    .slice(0, 199)
    .map((text, i) => ({ text, order: i }));
  return { name, items };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!["md", "txt"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Only .md and .txt files supported" }, { status: 400 });
  }

  const content = await file.text();
  const parsed = ext === "md" ? parseMarkdown(content) : parsePlainText(content);

  if (parsed.items.length === 0) {
    return NextResponse.json({ error: "No items found in file" }, { status: 400 });
  }

  const checklist = await prisma.checklist.create({
    data: {
      userId: session.user.id,
      name: parsed.name,
      items: { create: parsed.items },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(checklist, { status: 201 });
}
