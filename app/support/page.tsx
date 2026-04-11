import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import SupportClient from "./SupportClient";

export const metadata = {
  title: "Support Streakboard",
  description:
    "Send feedback or support Streakboard with a donation. Every bit helps keep the app free and improving.",
};

// Default Stripe Payment Links for Streakboard donations. These are public
// URLs (not API keys) — safe to ship in source. Env vars override them so
// a fork can swap in different links without editing code.
const DEFAULT_DONATION_URLS = {
  coffee: "https://donate.stripe.com/7sY6oIc9xf2CfDBcs38AE01",
  pizza: "https://buy.stripe.com/aFaaEYc9xf2CdvtgIj8AE02",
  taco: "https://buy.stripe.com/14A8wQc9x4nY8b9gIj8AE03",
  custom: "https://donate.stripe.com/14A8wQa1p2fQajh3Vx8AE04",
};

export default async function SupportPage() {
  const session = await auth();
  const donationUrls = {
    coffee:
      process.env.NEXT_PUBLIC_STRIPE_DONATION_URL_COFFEE ||
      DEFAULT_DONATION_URLS.coffee,
    pizza:
      process.env.NEXT_PUBLIC_STRIPE_DONATION_URL_PIZZA ||
      DEFAULT_DONATION_URLS.pizza,
    taco:
      process.env.NEXT_PUBLIC_STRIPE_DONATION_URL_TACO ||
      DEFAULT_DONATION_URLS.taco,
    custom:
      process.env.NEXT_PUBLIC_STRIPE_DONATION_URL_CUSTOM ||
      process.env.NEXT_PUBLIC_STRIPE_DONATION_URL ||
      DEFAULT_DONATION_URLS.custom,
  };
  const feedbackTo = process.env.FEEDBACK_TO_EMAIL || "yohsh9@gmail.com";
  return (
    <>
      <AppHeader />
      <SupportClient
        isSignedIn={!!session?.user}
        userEmail={session?.user?.email ?? ""}
        donationUrls={donationUrls}
        feedbackTo={feedbackTo}
      />
    </>
  );
}
