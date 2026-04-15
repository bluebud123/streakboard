import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAndSendVerification } from "@/lib/send-verification-email";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rateLimit";

export async function POST(req: Request) {
  // Defend signup endpoint against scripted account creation: 5 attempts /
  // 10 min per IP. Real users will never hit this.
  const rl = checkRateLimit(req, "signup", { limit: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many signup attempts. Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: rateLimitHeaders(rl.retryAfter) }
    );
  }

  const { name, username, email, password, studyingFor, examDate } = await req.json();

  if (!name || !username || !email || !password || !studyingFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (slug.length < 2) {
    return NextResponse.json({ error: "Username must be at least 2 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: slug }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: existing.email === email ? "Email already registered" : "Username taken" },
      { status: 409 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      username: slug,
      email,
      password: hashed,
      studyingFor,
      examDate: examDate || null,
      emailVerified: false,
    },
  });

  // Send verification email
  await createAndSendVerification(user.id, email);

  return NextResponse.json(
    { id: user.id, username: user.username, needsVerification: true },
    { status: 201 }
  );
}
