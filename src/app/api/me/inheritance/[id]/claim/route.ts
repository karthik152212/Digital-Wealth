import { requireVerifiedApiSession } from "@/lib/session";
import {
  fieldErrorsFrom,
  initiateClaimSchema,
  requestIdSchema,
} from "@/lib/inheritance-schemas";
import { initiateClaim } from "@/lib/inheritance";

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

  const parsed = initiateClaimSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await initiateClaim(
      session.user.id,
      session.user.email,
      id,
      parsed.data,
    );
    if (result.ok) {
      return Response.json({ ok: true, status: result.status });
    }
    if ("reason" in result) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    switch (result.conflict) {
      case "EXPIRED":
        return Response.json(
          {
            error:
              "The invitation window has elapsed. Expiry is not confirmation of death; no access was granted.",
            code: "EXPIRED",
          },
          { status: 409 },
        );
      case "CLAIM_CODE_REQUIRED":
        return Response.json(
          {
            error: "Validation failed.",
            fields: { claimCode: "Claim code is required for this invitation." },
            code: "CLAIM_CODE_REQUIRED",
          },
          { status: 400 },
        );
      case "CLAIM_CODE_INVALID":
        return Response.json(
          {
            error: "Validation failed.",
            fields: { claimCode: "Claim code is incorrect." },
            code: "CLAIM_CODE_INVALID",
          },
          { status: 400 },
        );
      case "CLAIM_CODE_LOCKED":
        return Response.json(
          {
            error:
              "Too many incorrect claim-code attempts. Ask the owner to issue a new invitation.",
            code: "CLAIM_CODE_LOCKED",
          },
          { status: 409 },
        );
      default:
        return Response.json(
          {
            error: "This request is not in a claimable state.",
            code: result.conflict,
          },
          { status: 409 },
        );
    }
  } catch (error) {
    console.error("Failed to initiate claim", error);
    return Response.json(
      { error: "Could not initiate the claim. Please try again." },
      { status: 500 },
    );
  }
}
