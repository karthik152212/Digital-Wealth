import { Suspense } from "react";
import type { Metadata } from "next";

import { isGoogleConfigured } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | Digital Wealth Vault",
};

export default async function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <Suspense>
        <LoginForm googleEnabled={isGoogleConfigured} />
      </Suspense>
    </div>
  );
}
