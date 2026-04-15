import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export async function GET(req: Request) {
  // Generous: signup form fires this on each keystroke (debounced). Cap is
  // mainly to prevent username enumeration scripts.
  const rl = checkRateLimit(req, "check-username", { limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { available: false, error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rl.retryAfter) }
    );
  }

  const { searchParams } = new URL(req.url);
  const u = searchParams.get("u")?.toLowerCase().replace(/[^a-z0-9_-]/g, "") ?? "";
  if (u.length < 2) return NextResponse.json({ available: false });
  const existing = await prisma.user.findUnique({ where: { username: u }, select: { id: true } });
  return NextResponse.json({ available: !existing });
}
