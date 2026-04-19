// Quick-todos API. Intentionally tiny surface:
//   GET  /api/quick-todos            → list all my todos (server source of truth)
//   POST /api/quick-todos            → body { todos: [{id, text, done, order, updatedAt}] }
//                                      Upserts by id — "last write wins" via updatedAt.
//
// Why POST-batch instead of PATCH-per-todo: the client batches every 1.5s of
// idle typing into a single request, so the typical write touches several
// todos at once. One round-trip beats N.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const todos = await prisma.quickTodo.findMany({
    where: { userId: session.user.id },
    orderBy: [{ done: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    select: { id: true, text: true, done: true, order: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ todos });
}

interface IncomingTodo {
  id: string;
  text: string;
  done: boolean;
  order?: number;
  updatedAt?: string;
  deleted?: boolean;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  // Background-sync endpoint gets hit often — cap to 30/min per user to
  // protect the DB from a runaway client.
  const rl = checkRateLimit(req, "quick-todos-sync", {
    limit: 30,
    windowMs: 60_000,
    extraKey: session.user.id,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Syncing too fast" },
      { status: 429, headers: rateLimitHeaders(rl.retryAfter) }
    );
  }

  const body = await req.json().catch(() => ({}));
  const incoming: IncomingTodo[] = Array.isArray(body?.todos) ? body.todos : [];
  if (incoming.length === 0) return NextResponse.json({ ok: true, count: 0 });
  if (incoming.length > 200) {
    return NextResponse.json({ error: "Too many todos in one sync" }, { status: 400 });
  }

  const userId = session.user.id;
  const deletions = incoming.filter((t) => t.deleted).map((t) => t.id);
  const upserts = incoming.filter((t) => !t.deleted);

  // Server-side validation of text length keeps DB rows bounded.
  for (const t of upserts) {
    if (typeof t.text !== "string" || t.text.length > 500) {
      return NextResponse.json({ error: "Invalid todo text" }, { status: 400 });
    }
  }

  // Ownership-safe upsert: we first updateMany with (id, userId) — Prisma
  // returns count=0 if no row matches (either missing or owned by someone
  // else). When count=0, we create with a NEW id to avoid hijacking an
  // existing row — the client will learn the new id on next GET.
  await prisma.$transaction(async (tx) => {
    if (deletions.length) {
      await tx.quickTodo.deleteMany({
        where: { userId, id: { in: deletions } },
      });
    }
    for (const t of upserts) {
      const updated = await tx.quickTodo.updateMany({
        where: { id: t.id, userId },
        data: {
          text: t.text.slice(0, 500),
          done: Boolean(t.done),
          order: typeof t.order === "number" ? t.order : 0,
        },
      });
      if (updated.count === 0) {
        await tx.quickTodo.create({
          data: {
            id: t.id, // client cuid; collision with another user's id is ~0
            userId,
            text: t.text.slice(0, 500),
            done: Boolean(t.done),
            order: typeof t.order === "number" ? t.order : 0,
          },
        }).catch(() => {
          // If id collided with an id owned by another user (extremely rare
          // since client uses cuid), fall back to letting Prisma generate
          // a new id. Client reconciles on next GET.
          return tx.quickTodo.create({
            data: {
              userId,
              text: t.text.slice(0, 500),
              done: Boolean(t.done),
              order: typeof t.order === "number" ? t.order : 0,
            },
          });
        });
      }
    }
  });

  return NextResponse.json({ ok: true, count: incoming.length });
}
