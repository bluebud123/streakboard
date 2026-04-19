import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LogsClient from "./LogsClient";

// Logs render is fully client-side so navigating /dashboard ↔ /logs feels
// instant. The client hydrates from a sessionStorage cache seeded by the
// dashboard, then revalidates in the background via /api/checkin. The
// server page here does only the auth check — no DB query, no blocking.
export default async function LogsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <LogsClient initialLogs={[]} />;
}
