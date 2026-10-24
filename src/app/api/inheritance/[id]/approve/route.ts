import { requireVerifiedApiSession } from "@/lib/session";
import { requestIdSchema } from "@/lib/inheritance-schemas";
import { approveClaim } from "@/lib/inheritance";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Inheritance request not found." };

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!requestIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  try {
    const result = await approveClaim(session.user.id, id);
    if (result.ok) {
      return Response.json({
        ok: true,
        authorizationId: result.authorizationId,
      });
    }
    if ("reason" in result) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json(
      {
        error:
          "This request is not awaiting owner confirmation. It may have already advanced or expired.",
        code: result.conflict,
      },
      { status: 409 },
    );
  } catch (error) {
    console.error("Failed to approve claim", error);
    return Response.json(
      { error: "Could not approve the claim. Please try again." },
      { status: 500 },
    );
  }
}
