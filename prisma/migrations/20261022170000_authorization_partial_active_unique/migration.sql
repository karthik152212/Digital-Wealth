-- DropIndex
DROP INDEX "AssetAuthorization_assetId_nomineeId_attempt_key";
-- CreateIndex
-- Partial unique: only ACTIVE authorizations occupy the (assetId, nomineeId, attempt)
-- slot. Historical REVOKED rows are preserved and never block a new grant.
CREATE UNIQUE INDEX "AssetAuthorization_assetId_nomineeId_attempt_active_key"
  ON "AssetAuthorization"("assetId", "nomineeId", "attempt")
  WHERE "status" = 'ACTIVE';
