-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "nomineeCanSeeAccountReference" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AssetAuthorization" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "InheritanceRequest" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "claimCodeHash" TEXT,
ADD COLUMN     "claimCodeAttempts" INTEGER NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX "AssetAuthorization_assetId_nomineeId_key";

-- DropIndex
DROP INDEX "InheritanceRequest_assetId_nomineeId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AssetAuthorization_assetId_nomineeId_attempt_key" ON "AssetAuthorization"("assetId", "nomineeId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "InheritanceRequest_assetId_nomineeId_attempt_key" ON "InheritanceRequest"("assetId", "nomineeId", "attempt");
