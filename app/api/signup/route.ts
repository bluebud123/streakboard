import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAndSendVerification } from "@/lib/send-verification-email";

export async function POST(req: Request) {
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
