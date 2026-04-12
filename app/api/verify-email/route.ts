import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAndSendVerification } from "@/lib/send-verification-email";

export async function POST(req: Request) {
  const { username, code, resend } = await req.json();

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  // Resend code
  if (resend) {
    await createAndSendVerification(user.id, user.email);
    return NextResponse.json({ ok: true, resent: true });
  }

  // Verify code
  if (!code) {
    return NextResponse.json({ error: "Code required" }, { status: 400 });
  }

  const verification = await prisma.emailVerification.findFirst({
    where: { userId: user.id, code },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (verification.expiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired — please request a new one" }, { status: 400 });
  }

  // Mark user as verified and clean up
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
    prisma.emailVerification.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true, verified: true });
}
