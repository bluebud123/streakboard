import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

// POST: toggle like/dislike. body: { type: "LIKE" | "DISLIKE" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { type } = await req.json();
  if (type !== "LIKE" && type !== "DISLIKE") return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const existing = await prisma.checklistLike.findUnique({
    where: { checklistId_userId: { checklistId: params.id, userId } },
  });

  if (existing && existing.type === type) {
    // Same vote → remove (toggle off)
    await prisma.checklistLike.delete({ where: { id: existing.id } });
    const counts = await getCounts(params.id);
    return NextResponse.json({ removed: true, type, ...counts });
  } else {
    // New vote or changing vote
    await prisma.checklistLike.upsert({
      where: { checklistId_userId: { checklistId: params.id, userId } },
      create: { checklistId: params.id, userId, type },
      update: { type },
    });
    const counts = await getCounts(params.id);
    return NextResponse.json({ voted: true, type, ...counts });
  }
}

// GET: get like/dislike counts + current user's vote
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;

  const counts = await getCounts(params.id);
  let myVote: string | null = null;
  if (userId) {
    const mine = await prisma.checklistLike.findUnique({
      where: { checklistId_userId: { checklistId: params.id, userId } },
    });
    myVote = mine?.type ?? null;
  }
  return NextResponse.json({ ...counts, myVote });
}

async function getCounts(checklistId: string) {
  const likes = await prisma.checklistLike.count({ where: { checklistId, type: "LIKE" } });
  const dislikes = await prisma.checklistLike.count({ where: { checklistId, type: "DISLIKE" } });
  return { likes, dislikes };
}
