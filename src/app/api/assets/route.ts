import { requireVerifiedApiSession } from "@/lib/session";
import { createAssetSchema, fieldErrorsFrom } from "@/lib/asset-schemas";
import { createAsset, listAssets } from "@/lib/assets";

export async function GET(request: Request) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const assets = await listAssets(session.user.id);
  return Response.json({ assets });
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

  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const id = await createAsset(session.user.id, parsed.data);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("Failed to create asset", error);
    return Response.json(
      { error: "Could not save the asset. Please try again." },
      { status: 500 },
    );
  }
}
