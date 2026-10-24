import { requireVerifiedApiSession } from "@/lib/session";
import { assetIdSchema, fieldErrorsFrom, updateAssetSchema } from "@/lib/asset-schemas";
import { deleteAsset, getAsset, updateAsset } from "@/lib/assets";

type RouteContext = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: "Asset not found." };

export async function GET(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!assetIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  const asset = await getAsset(session.user.id, id);
  if (!asset) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  return Response.json({ asset });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!assetIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed.", fields: fieldErrorsFrom(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await updateAsset(session.user.id, id, parsed.data);
    if (result === "not_found") {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to update asset", error);
    return Response.json(
      { error: "Could not save the asset. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const guard = await requireVerifiedApiSession(request);
  if (guard.response) return guard.response;
  const session = guard.session;

  const { id } = await params;
  if (!assetIdSchema.safeParse(id).success) {
    return Response.json(NOT_FOUND, { status: 404 });
  }

  try {
    const result = await deleteAsset(session.user.id, id);
    if (result === "not_found") {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    if (result === "protected") {
      return Response.json(
        {
          error:
            "This asset is linked to inheritance records and cannot be deleted. Archive it instead.",
          code: "HAS_INHERITANCE_RECORDS",
        },
        { status: 409 },
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete asset", error);
    return Response.json(
      { error: "Could not delete the asset. Please try again." },
      { status: 500 },
    );
  }
}
