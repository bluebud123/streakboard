import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import SupportClient from "./SupportClient";

export const metadata = {
  title: "Support Streakboard",
  description:
    "Send feedback or support Streakboard with a donation. Every bit helps keep the app free and improving.",
};

export default async function SupportPage() {
  const session = await auth();
  const donationUrl = process.env.NEXT_PUBLIC_STRIPE_DONATION_URL || "";
  const feedbackTo = process.env.FEEDBACK_TO_EMAIL || "yohsh9@gmail.com";
  return (
    <>
      <AppHeader />
      <SupportClient
        isSignedIn={!!session?.user}
        userEmail={session?.user?.email ?? ""}
        donationUrl={donationUrl}
        feedbackTo={feedbackTo}
      />
    </>
  );
}
