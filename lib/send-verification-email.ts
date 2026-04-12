import { prisma } from "@/lib/db";

const VERIFICATION_FROM =
  process.env.FEEDBACK_FROM_EMAIL || "Streakboard <onboarding@resend.dev>";

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createAndSendVerification(userId: string, email: string) {
  // Delete any existing codes for this user
  await prisma.emailVerification.deleteMany({ where: { userId } });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.emailVerification.create({
    data: { userId, code, expiresAt },
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[verify] No RESEND_API_KEY — code for ${email}: ${code}`);
    return { sent: false, code };
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
      <h1 style="color:#fbbf24;margin:0 0 8px;font-size:24px;">Welcome to Streakboard</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px;">Enter this code to verify your email:</p>
      <div style="background:#1e293b;border:2px solid #fbbf24;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#fbbf24;">${code}</span>
      </div>
      <p style="color:#64748b;font-size:12px;margin:0;">This code expires in 15 minutes. If you didn&rsquo;t sign up, ignore this email.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: VERIFICATION_FROM,
      to: [email],
      subject: `${code} — Verify your Streakboard account`,
      html,
      text: `Your Streakboard verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[verify] Resend error:", res.status, err);
    return { sent: false, code };
  }

  return { sent: true };
}
