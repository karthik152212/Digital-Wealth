import { connection } from "next/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return <>{children}</>;
}
