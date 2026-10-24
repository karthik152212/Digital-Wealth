import { requireVerifiedApiSession } from "@/lib/session";
import {
  declineRequestSchema,
  fieldErrorsFrom,
  requestIdSchema,
} from "@/lib/inheritance-schemas";
import { declineRequest } from "@/lib/inheritance";

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

  const parsed = declineRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await declineRequest(
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
    return Response.json(
      {
        error:
          "Only open requests can be declined. Released, revoked, expired, or already-declined requests cannot be changed.",
        code: result.conflict,
      },
      { status: 409 },
    );
  } catch (error) {
    console.error("Failed to decline request", error);
    return Response.json(
      { error: "Could not decline the request. Please try again." },
      { status: 500 },
    );
  }
}
