-- CreateEnum
CREATE TYPE "NomineeStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "Nominee" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "status" "NomineeStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Nominee_ownerId_status_idx" ON "Nominee"("ownerId", "status");
