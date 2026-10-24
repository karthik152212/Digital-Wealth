import { requireVerifiedApiSession } from "@/lib/session";
import { nomineeIdSchema } from "@/lib/nominee-schemas";
import { revokeNominee } from "@/lib/nominees";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Nominee not found." };

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!nomineeIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  try {
    const result = await revokeNominee(session.user.id, id);
    if (!result.ok) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json({
      ok: true,
      alreadyRevoked: result.alreadyRevoked,
      revokedRequests: result.revokedRequests,
      revokedAuthorizations: result.revokedAuthorizations,
    });
  } catch (error) {
    console.error("Failed to revoke nominee", error);
    return Response.json(
      { error: "Could not revoke the nominee. Please try again." },
      { status: 500 },
    );
  }
}
