import { requireVerifiedApiSession } from "@/lib/session";
import { assetIdSchema, fieldErrorsFrom } from "@/lib/asset-schemas";
import { inviteRequestSchema } from "@/lib/nominee-schemas";
import { inviteToAsset } from "@/lib/nominees";

type RouteContext = { params: Promise<{ id: string }> };

const ASSET_NOT_FOUND = { error: "Asset not found." };
const NOMINEE_NOT_FOUND = { error: "Nominee not found." };

export async function POST(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!assetIdSchema.safeParse(id).success) {
    return Response.json(ASSET_NOT_FOUND, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = inviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await inviteToAsset(
      session.user.id,
      id,
      parsed.data.nomineeId,
    );
    if (!result.ok) {
      if ("reason" in result) {
        return result.reason === "asset_not_found"
          ? Response.json(ASSET_NOT_FOUND, { status: 404 })
          : Response.json(NOMINEE_NOT_FOUND, { status: 404 });
      }
      return result.conflict === "NOMINEE_REVOKED"
        ? Response.json(
            {
              error: "This nominee is revoked. Restore them first.",
              code: "NOMINEE_REVOKED",
            },
            { status: 409 },
          )
        : Response.json(
            {
              error:
                "An inheritance request for this nominee and asset already exists.",
              code: "REQUEST_EXISTS",
            },
            { status: 409 },
          );
    }
    return Response.json(
      { id: result.requestId, claimCode: result.claimCode },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create inheritance request", error);
    return Response.json(
      { error: "Could not send the invitation. Please try again." },
      { status: 500 },
    );
  }
}
