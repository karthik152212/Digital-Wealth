import { requireVerifiedApiSession } from "@/lib/session";
import {
  fieldErrorsFrom,
  rejectClaimSchema,
  requestIdSchema,
} from "@/lib/inheritance-schemas";
import { rejectClaim } from "@/lib/inheritance";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = rejectClaimSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await rejectClaim(session.user.id, id, parsed.data);
    if (result.ok) {
      return Response.json({ ok: true });
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
    console.error("Failed to reject claim", error);
    return Response.json(
      { error: "Could not reject the claim. Please try again." },
      { status: 500 },
    );
  }
}
