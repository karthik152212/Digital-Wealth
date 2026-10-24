import { requireVerifiedApiSession } from "@/lib/session";
import { authorizationIdSchema } from "@/lib/inheritance-schemas";
import { revokeAuthorization } from "@/lib/inheritance";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Authorization not found." };

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!authorizationIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  try {
    const result = await revokeAuthorization(session.user.id, id);
    if (result.ok) {
      return Response.json({ ok: true, alreadyRevoked: !!result.alreadyDone });
    }
    return Response.json(NOT_FOUND, { status: 404 });
  } catch (error) {
    console.error("Failed to revoke authorization", error);
    return Response.json(
      { error: "Could not revoke the authorization. Please try again." },
      { status: 500 },
    );
  }
}
