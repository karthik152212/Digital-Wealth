import { requireVerifiedApiSession } from "@/lib/session";
import { listMyInheritance } from "@/lib/inheritance";

export async function GET(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  try {
    const items = await listMyInheritance(session.user.email);
    return Response.json({ items });
  } catch (error) {
    console.error("Failed to list inheritance requests", error);
    return Response.json(
      { error: "Could not load inheritance requests. Please try again." },
      { status: 500 },
    );
  }
}
