-- CreateEnum
CREATE TYPE "StagingSource" AS ENUM ('WHATSAPP', 'WEB');

-- CreateEnum
CREATE TYPE "StagingStatus" AS ENUM ('RESERVED', 'DOWNLOADING', 'STORED', 'EXTRACTED', 'MOVED', 'RETRYING', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaExpectedSlot" AS ENUM ('CARTE_GRISE_RECTO', 'CARTE_GRISE_VERSO', 'CMC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WhatsAppBotState" ADD VALUE 'MAIN_MENU';
ALTER TYPE "WhatsAppBotState" ADD VALUE 'DOCUMENT_CHOICE';
ALTER TYPE "WhatsAppBotState" ADD VALUE 'WAITING_FOR_RECTO';
ALTER TYPE "WhatsAppBotState" ADD VALUE 'WAITING_FOR_VERSO';
ALTER TYPE "WhatsAppBotState" ADD VALUE 'WAITING_FOR_CMC';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WhatsAppMessageStatus" ADD VALUE 'PENDING';
ALTER TYPE "WhatsAppMessageStatus" ADD VALUE 'RETRYING';

-- AlterTable
ALTER TABLE "PasswordResetChallenge" ALTER COLUMN "otpHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN     "activeDossierId" TEXT;

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "lastErrorCode" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WebDraftSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebDraftSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaStaging" (
    "id" TEXT NOT NULL,
    "source" "StagingSource" NOT NULL,
    "waMessageId" TEXT,
    "mediaId" TEXT,
    "waConversationId" TEXT,
    "webDraftId" TEXT,
    "expectedSlot" "MediaExpectedSlot" NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "StagingStatus" NOT NULL DEFAULT 'RESERVED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "extractedData" JSONB,

    CONSTRAINT "MediaStaging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaStaging_waMessageId_key" ON "MediaStaging"("waMessageId");

-- AddForeignKey
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_activeDossierId_fkey" FOREIGN KEY ("activeDossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaStaging" ADD CONSTRAINT "MediaStaging_waConversationId_fkey" FOREIGN KEY ("waConversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaStaging" ADD CONSTRAINT "MediaStaging_webDraftId_fkey" FOREIGN KEY ("webDraftId") REFERENCES "WebDraftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Migrate User phone numbers
UPDATE "User"
SET phone = '+221' || phone
WHERE length(phone) = 9 AND phone NOT LIKE '+%';

-- Migrate Dossier phone numbers
UPDATE "Dossier"
SET phone = '+221' || phone
WHERE length(phone) = 9 AND phone NOT LIKE '+%';
