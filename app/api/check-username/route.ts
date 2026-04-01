import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get("u")?.toLowerCase().replace(/[^a-z0-9_-]/g, "") ?? "";
  if (u.length < 2) return NextResponse.json({ available: false });
  const existing = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  return NextResponse.json({ available: !existing });
}
