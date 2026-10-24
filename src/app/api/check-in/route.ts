import { prisma } from "@/lib/prisma";
import { requireVerifiedApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastSeenAt: new Date() },
  });

  return Response.json({ ok: true });
}
