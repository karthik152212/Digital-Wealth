import { connection } from "next/server";

import { requireVerifiedSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  // Redirects to /login when unauthenticated and to the verification
  // screen when the account's email is not verified yet.
  await requireVerifiedSession();
  return <>{children}</>;
}
