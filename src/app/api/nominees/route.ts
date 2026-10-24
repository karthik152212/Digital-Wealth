import { requireVerifiedApiSession } from "@/lib/session";
import { createNomineeSchema, fieldErrorsFrom } from "@/lib/nominee-schemas";
import { createNominee, listNominees } from "@/lib/nominees";

export async function GET(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const nominees = await listNominees(session.user.id);
  return Response.json({ nominees });
}

export async function POST(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createNomineeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createNominee(session.user.id, parsed.data);
    if (!result.ok) {
      return result.conflict === "NOMINEE_EXISTS"
        ? Response.json(
            {
              error: "A nominee with this email already exists in your vault.",
              code: "NOMINEE_EXISTS",
            },
            { status: 409 },
          )
        : Response.json(
            {
              error:
                "A nominee with this email was revoked. Restore them instead of adding a duplicate.",
              code: "NOMINEE_REVOKED",
            },
            { status: 409 },
          );
    }
    return Response.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create nominee", error);
    return Response.json(
      { error: "Could not save the nominee. Please try again." },
      { status: 500 },
    );
  }
}
