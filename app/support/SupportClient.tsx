"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Props {
  isSignedIn: boolean;
  userEmail: string;
  donationUrls: {
    coffee: string;
    pizza: string;
    taco: string;
    custom: string;
  };
  feedbackTo: string;
}

const CATEGORIES = [
  { value: "bug", label: "🐛 Bug report" },
  { value: "feature", label: "💡 Feature idea" },
  { value: "template", label: "📋 Template request" },
  { value: "other", label: "💬 Other / just saying hi" },
];

export default function SupportClient({ isSignedIn, userEmail, donationUrls, feedbackTo }: Props) {
  // Each preset links to its own dedicated Stripe Payment Link (fixed price),
  // except the last which opens a "let customer choose" link.
  const presets = [
    { emoji: "☕", label: "Coffee", amount: "$3", url: donationUrls.coffee },
    { emoji: "🍕", label: "Pizza", amount: "$5", url: donationUrls.pizza },
    { emoji: "🌮", label: "Taco", amount: "$10", url: donationUrls.taco },
  ];
  const [category, setCategory] = useState("feature");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 4) {
      toast.error("Please share a bit more detail.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, contact }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not send — please try the email link below.");
        setSending(false);
        return;
      }
      if (data?.mailtoFallback) {
        // Server is in log-only mode (no RESEND_API_KEY). Offer a mailto as safety net.
        toast.success("Saved! We'll also open your email app as a backup.");
        const subject = encodeURIComponent(`[Streakboard] ${category}`);
        const body = encodeURIComponent(message);
        window.location.href = `mailto:${feedbackTo}?subject=${subject}&body=${body}`;
      } else {
        toast.success("Feedback sent — thank you!");
      }
      setSent(true);
      setMessage("");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const hasDonationLink =
    donationUrls.coffee.length > 0 ||
    donationUrls.pizza.length > 0 ||
    donationUrls.taco.length > 0 ||
    donationUrls.custom.length > 0;
  const mailtoHref = `mailto:${feedbackTo}?subject=${encodeURIComponent("[Streakboard] " + category)}&body=${encodeURIComponent(message)}`;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Hero */}
      <header className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-100">
          Help shape <span className="text-amber-400">Streakboard</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
          Streakboard is built and maintained by a tiny team. Your feedback drives every
          update — and if you&rsquo;d like to chip in for the coffee that keeps it alive,
          that means the world to us. 💛
        </p>
      </header>

      {/* Donation section */}
      <section className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💝</span>
          <h2 className="text-lg font-bold text-slate-100">Support the project</h2>
        </div>
        <p className="text-sm text-slate-400">
          Streakboard is free and ad-free. Donations cover hosting, database,
          and new features. Pick an amount below — it opens a secure Stripe
          checkout in a new tab.
        </p>

        {hasDonationLink ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {presets.map((p) =>
                p.url ? (
                  <a
                    key={p.label}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-4 px-2 bg-slate-900/60 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/50 rounded-xl text-center transition-all group"
                  >
                    <div className="text-2xl mb-1">{p.emoji}</div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400">
                      {p.label}
                    </div>
                    <div className="text-[11px] text-slate-500 group-hover:text-amber-400/80">
                      {p.amount}
                    </div>
                  </a>
                ) : (
                  <div
                    key={p.label}
                    className="py-4 px-2 bg-slate-900/30 border border-slate-800 rounded-xl text-center opacity-40"
                    title="Not configured yet"
                  >
                    <div className="text-2xl mb-1">{p.emoji}</div>
                    <div className="text-xs text-slate-500">{p.label}</div>
                  </div>
                )
              )}
            </div>
            {donationUrls.custom ? (
              <a
                href={donationUrls.custom}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-center transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                💛 Donate a custom amount →
              </a>
            ) : null}
            <p className="text-xs text-slate-500 text-center">
              Secure · No account needed · Apple Pay / Google Pay / card
            </p>
          </>
        ) : (
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-sm text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">⚙️ Donation link not configured yet</p>
            <p>
              To enable donations, the site owner needs to create a{" "}
              <a
                href="https://dashboard.stripe.com/payment-links"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                Stripe Payment Link
              </a>{" "}
              with &ldquo;let customers choose what to pay&rdquo; enabled, then set{" "}
              <code className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-400">
                NEXT_PUBLIC_STRIPE_DONATION_URL
              </code>{" "}
              in the environment.
            </p>
            <p>
              In the meantime, you can email{" "}
              <a href={`mailto:${feedbackTo}`} className="text-amber-400 hover:underline">
                {feedbackTo}
              </a>{" "}
              to arrange a donation directly.
            </p>
          </div>
        )}
      </section>

      {/* Feedback section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💬</span>
          <h2 className="text-lg font-bold text-slate-100">Send feedback</h2>
        </div>
        <p className="text-sm text-slate-400">
          Bug, feature idea, template request, or just want to say hi — we read every
          message and reply when we can.
        </p>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <p className="text-emerald-400 font-semibold">✓ Thanks — message received!</p>
            <p className="text-sm text-slate-400">
              We&rsquo;ll reply at {contact || "your account email"} if you included contact info.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setMessage("");
              }}
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Send another →
            </button>
          </div>
        ) : (
          <form onSubmit={submitFeedback} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`py-2 px-2 text-xs font-medium rounded-lg border transition-all ${
                      category === c.value
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind…"
                rows={6}
                maxLength={5000}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-y"
                required
              />
              <div className="text-[10px] text-slate-600 text-right mt-1">
                {message.length} / 5000
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Your email <span className="text-slate-600">(optional — for replies)</span>
              </label>
              <input
                type="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={isSignedIn ? userEmail || "you@example.com" : "you@example.com"}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="submit"
                disabled={sending || message.trim().length < 4}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  "Send feedback →"
                )}
              </button>
              <a
                href={mailtoHref}
                className="sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-lg text-center text-sm transition-colors"
                title="Open your email client instead"
              >
                ✉ Email directly
              </a>
            </div>
          </form>
        )}
      </section>

      {/* Other ways to help */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-200">💡 Free ways to help</h2>
        <ul className="text-sm text-slate-400 space-y-2 list-none">
          <li>⭐ Tell a friend who&rsquo;s studying for a big exam.</li>
          <li>📋 Share a template you built so others can use it too.</li>
          <li>🐛 Report bugs you hit — they almost always ship a fix fast.</li>
          <li>💬 Reply with what you wish Streakboard could do.</li>
        </ul>
      </section>
    </main>
  );
}
