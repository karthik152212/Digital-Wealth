import { requireVerifiedApiSession } from "@/lib/session";
import {
  fieldErrorsFrom,
  requestIdSchema,
  submitClaimSchema,
} from "@/lib/inheritance-schemas";
import { submitClaim } from "@/lib/inheritance";

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

  const parsed = submitClaimSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await submitClaim(
      session.user.id,
      session.user.email,
      id,
    );
    if (result.ok) {
      return Response.json({ ok: true, status: result.status });
    }
    if ("reason" in result) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json(
      {
        error:
          "This request is not awaiting claim submission. It may have expired or already advanced.",
        code: result.conflict,
      },
      { status: 409 },
    );
  } catch (error) {
    console.error("Failed to submit claim", error);
    return Response.json(
      { error: "Could not submit the claim. Please try again." },
      { status: 500 },
    );
  }
}
