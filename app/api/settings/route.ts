import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { action } = body;

  if (action === "updateProfile") {
    const { name, username, email, studyingFor, examDate, isPublic } = body;

    // Check uniqueness of username and email if they changed
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
        NOT: { id: userId },
      },
    });

    if (existing) {
      if (existing.username === username) return NextResponse.json({ error: "Username already taken" }, { status: 400 });
      if (existing.email === email) return NextResponse.json({ error: "Email already taken" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name, username, email, studyingFor, examDate, isPublic },
    });

    return NextResponse.json(updated);
  }

  if (action === "changePassword") {
    const { currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
