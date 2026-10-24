import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { Session } from "@/lib/auth";

export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Server-side page guard for authenticated pages: unverified sessions are
 * sent to the verification screen instead of the dashboard. Verification
 * status comes from Better Auth's server-side session state.
 */
export async function requireVerifiedSession() {
  const session = await requireSession();
  if (!session.user.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);
  }
  return session;
}

export type VerifiedApiSessionResult =
  | { session: Session; response?: undefined }
  | { session?: undefined; response: Response };

/**
 * Server-side API guard: 401 when unauthenticated, 403 when the account's
 * email is not verified. Responses never expose account state beyond the
 * reason for rejection.
 */
export async function requireVerifiedApiSession(
  request: Request,
): Promise<VerifiedApiSessionResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!session.user.emailVerified) {
    return {
      response: Response.json(
        { error: "Email verification required." },
        { status: 403 },
      ),
    };
  }
  return { session };
}
