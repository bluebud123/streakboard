import { NextResponse } from "next/server";
import { auth } from "@/auth";

// ─── Feedback endpoint ────────────────────────────────────────────────────────
// POST /api/feedback { category, message, contact? }
//
// Delivery strategy (zero new npm deps — uses native fetch):
//   1. If RESEND_API_KEY is set, email via Resend HTTP API to FEEDBACK_TO_EMAIL
//      (defaults to yohsh9@gmail.com).
//   2. Otherwise, log to server console so Vercel logs capture it and return
//      { mailtoFallback: true } so the client can offer a direct mailto link.
//
// We never 500 on a missing key — we want feedback to *always* go somewhere.

const FEEDBACK_TO = process.env.FEEDBACK_TO_EMAIL || "yohsh9@gmail.com";
const FEEDBACK_FROM = process.env.FEEDBACK_FROM_EMAIL || "Streakboard <onboarding@resend.dev>";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));
    const category: string = (body?.category ?? "general").toString().slice(0, 40);
    const message: string = (body?.message ?? "").toString().trim();
    const contact: string = (body?.contact ?? "").toString().trim().slice(0, 200);

    if (message.length < 4) {
      return NextResponse.json(
        { error: "Message is too short — please share a bit more detail." },
        { status: 400 }
      );
    }
    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message is too long — please keep it under 5000 characters." },
        { status: 400 }
      );
    }

    const who = session?.user
      ? `@${(session.user as { username?: string }).username ?? ""} (${session.user.email ?? "no email"})`
      : "anonymous visitor";

    const plainBody = [
      `Category: ${category}`,
      `From: ${who}`,
      contact ? `Contact: ${contact}` : null,
      `Received: ${new Date().toISOString()}`,
      ``,
      `─────────────────────────────`,
      message,
      `─────────────────────────────`,
    ]
      .filter(Boolean)
      .join("\n");

    const htmlBody = `
      <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
        <h2 style="color:#fbbf24;margin:0 0 12px;">New Streakboard feedback</h2>
        <p style="margin:4px 0;color:#94a3b8;font-size:13px;"><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p style="margin:4px 0;color:#94a3b8;font-size:13px;"><strong>From:</strong> ${escapeHtml(who)}</p>
        ${contact ? `<p style="margin:4px 0;color:#94a3b8;font-size:13px;"><strong>Contact:</strong> ${escapeHtml(contact)}</p>` : ""}
        <hr style="border:none;border-top:1px solid #334155;margin:16px 0;" />
        <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#e2e8f0;margin:0;">${escapeHtml(message)}</pre>
      </div>
    `;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Graceful degradation: log so it's captured in Vercel logs, and tell the
      // client to offer a mailto fallback so the user isn't stranded.
      console.log("[feedback] RESEND_API_KEY not set — falling back to console log");
      console.log(plainBody);
      return NextResponse.json(
        { ok: true, delivered: "log", mailtoFallback: true, to: FEEDBACK_TO },
        { status: 200 }
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FEEDBACK_FROM,
        to: [FEEDBACK_TO],
        reply_to: contact && /@/.test(contact) ? contact : undefined,
        subject: `[Streakboard] ${category} — ${message.slice(0, 60).replace(/\n/g, " ")}`,
        text: plainBody,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[feedback] Resend error:", res.status, errText);
      // Don't 500 — still give the user a mailto fallback so the message isn't lost.
      return NextResponse.json(
        { ok: true, delivered: "log", mailtoFallback: true, to: FEEDBACK_TO },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, delivered: "email" });
  } catch (err) {
    console.error("[feedback] unexpected error:", err);
    return NextResponse.json(
      { error: "Could not send feedback. Please email yohsh9@gmail.com directly." },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
