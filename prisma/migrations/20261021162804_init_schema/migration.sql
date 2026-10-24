-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('CRYPTO', 'DOMAIN', 'CLOUD_STORAGE', 'INVESTMENT', 'GAMING', 'DIGITAL_CONTENT', 'SOCIAL_MEDIA', 'PAYMENT_ACCOUNT', 'SOFTWARE_LICENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransferPolicy" AS ENUM ('ALLOWED', 'RESTRICTED', 'PROHIBITED', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('OFFICIAL_SITE', 'SELLING_POLICY', 'TRANSFER_POLICY', 'SUPPORT', 'HELP_CENTER', 'RECOVERY');

-- CreateEnum
CREATE TYPE "InheritanceStatus" AS ENUM ('INVITED', 'ELIGIBLE', 'CLAIMED_PENDING_CONFIRM', 'RELEASED', 'REVOKED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InheritanceAction" AS ENUM ('INVITED', 'REMINDER_SENT', 'ELIGIBILITY_MET', 'CLAIM_STARTED', 'IDENTITY_RECONFIRMED', 'RELEASED', 'REVOKED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AuthAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INACTIVITY_WARNING', 'GRACE_NOTICE', 'NOMINEE_INVITE', 'ACCESS_RELEASED', 'AUTHORIZATION_CHANGED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "supportUrl" TEXT,
    "policyUrl" TEXT,
    "transferPolicy" "TransferPolicy" NOT NULL DEFAULT 'UNVERIFIED',
    "policyNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "AssetCategory" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "providerName" TEXT NOT NULL,
    "providerId" TEXT,
    "accountReference" TEXT,
    "estimatedValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "valuationBasis" TEXT,
    "valuationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownershipEvidence" TEXT,
    "recoveryInstructions" TEXT,
    "resaleEligible" BOOLEAN NOT NULL DEFAULT false,
    "resaleNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "basis" TEXT,
    "valuedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellingStep" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "officialUrl" TEXT,

    CONSTRAINT "SellingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialLink" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "LinkType" NOT NULL,

    CONSTRAINT "OfficialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nominee" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "relationship" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nominee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAuthorization" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "status" "AuthAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AssetAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InheritanceRequest" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InheritanceStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graceEndsAt" TIMESTAMP(3) NOT NULL,
    "eligibleAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InheritanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InheritanceEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "InheritanceAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InheritanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_isDemo_idx" ON "User"("isDemo");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE INDEX "Provider_name_idx" ON "Provider"("name");

-- CreateIndex
CREATE INDEX "Asset_ownerId_status_idx" ON "Asset"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_providerId_idx" ON "Asset"("providerId");

-- CreateIndex
CREATE INDEX "Valuation_assetId_valuedAt_idx" ON "Valuation"("assetId", "valuedAt");

-- CreateIndex
CREATE INDEX "SellingStep_assetId_position_idx" ON "SellingStep"("assetId", "position");

-- CreateIndex
CREATE INDEX "OfficialLink_assetId_idx" ON "OfficialLink"("assetId");

-- CreateIndex
CREATE INDEX "Nominee_ownerId_idx" ON "Nominee"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Nominee_ownerId_email_key" ON "Nominee"("ownerId", "email");

-- CreateIndex
CREATE INDEX "AssetAuthorization_nomineeId_status_idx" ON "AssetAuthorization"("nomineeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetAuthorization_assetId_nomineeId_key" ON "AssetAuthorization"("assetId", "nomineeId");

-- CreateIndex
CREATE INDEX "InheritanceRequest_status_graceEndsAt_idx" ON "InheritanceRequest"("status", "graceEndsAt");

-- CreateIndex
CREATE INDEX "InheritanceRequest_nomineeId_status_idx" ON "InheritanceRequest"("nomineeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InheritanceRequest_assetId_nomineeId_key" ON "InheritanceRequest"("assetId", "nomineeId");

-- CreateIndex
CREATE INDEX "InheritanceEvent_requestId_createdAt_idx" ON "InheritanceEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellingStep" ADD CONSTRAINT "SellingStep_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialLink" ADD CONSTRAINT "OfficialLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominee" ADD CONSTRAINT "Nominee_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAuthorization" ADD CONSTRAINT "AssetAuthorization_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAuthorization" ADD CONSTRAINT "AssetAuthorization_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Nominee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAuthorization" ADD CONSTRAINT "AssetAuthorization_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceRequest" ADD CONSTRAINT "InheritanceRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceRequest" ADD CONSTRAINT "InheritanceRequest_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Nominee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceRequest" ADD CONSTRAINT "InheritanceRequest_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceEvent" ADD CONSTRAINT "InheritanceEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InheritanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InheritanceEvent" ADD CONSTRAINT "InheritanceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
