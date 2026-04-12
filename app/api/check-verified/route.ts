import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("u")?.toLowerCase().trim();
  if (!username) return NextResponse.json({ exists: false });

  const user = await prisma.user.findUnique({
    where: { username },
    select: { emailVerified: true },
  });

  if (!user) return NextResponse.json({ exists: false });
  return NextResponse.json({ exists: true, verified: user.emailVerified });
}
