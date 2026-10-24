import { requireVerifiedApiSession } from "@/lib/session";
import {
  fieldErrorsFrom,
  nomineeIdSchema,
  updateNomineeSchema,
} from "@/lib/nominee-schemas";
import { updateNominee } from "@/lib/nominees";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Nominee not found." };

export async function PATCH(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!nomineeIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateNomineeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await updateNominee(session.user.id, id, parsed.data);
    if (result === "not_found") {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to update nominee", error);
    return Response.json(
      { error: "Could not save the nominee. Please try again." },
      { status: 500 },
    );
  }
}
