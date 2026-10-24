import type { Metadata } from "next";

import { AssetForm } from "@/components/assets/asset-form";

export const instant = false;

export const metadata: Metadata = {
  title: "Add asset | Digital Wealth Vault",
};

export default function NewAssetPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <AssetForm mode="create" />
    </div>
  );
}
