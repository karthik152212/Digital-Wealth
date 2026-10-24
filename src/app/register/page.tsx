import { Suspense } from "react";
import type { Metadata } from "next";

import { isGoogleConfigured } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register | Digital Wealth Vault",
};

export default async function RegisterPage() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <Suspense>
        <RegisterForm googleEnabled={isGoogleConfigured} />
      </Suspense>
    </div>
  );
}
