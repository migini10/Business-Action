-- CreateEnum
CREATE TYPE "WhatsAppSupportStatus" AS ENUM ('TO_DO', 'IN_PROGRESS', 'RESOLVED');

-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "lastReadAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3),
ADD COLUMN "supportStatus" "WhatsAppSupportStatus" NOT NULL DEFAULT 'RESOLVED';

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WhatsAppMessage_conversationId_direction_readAt_idx" ON "WhatsAppMessage"("conversationId", "direction", "readAt");

-- Backfill Conversations
UPDATE "WhatsAppConversation"
SET "supportStatus" = 'TO_DO'
WHERE "botState" = 'HUMAN_SUPPORT';

-- Backfill Messages
UPDATE "WhatsAppMessage"
SET "readAt" = CURRENT_TIMESTAMP
WHERE "direction" = 'INBOUND';
