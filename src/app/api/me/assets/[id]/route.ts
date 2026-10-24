import { requireVerifiedApiSession } from "@/lib/session";
import { assetIdSchema } from "@/lib/asset-schemas";
import { getReleasedAssetForNominee } from "@/lib/inheritance";

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

  try {
    const released = await getReleasedAssetForNominee(session.user.email, id);
    if (!released) {
      return Response.json(NOT_FOUND, { status: 404 });
    }
    return Response.json(released);
  } catch (error) {
    console.error("Failed to load released asset", error);
    return Response.json(
      { error: "Could not load the asset. Please try again." },
      { status: 500 },
    );
  }
}
