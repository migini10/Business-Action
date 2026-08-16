-- AlterEnum
ALTER TYPE "WhatsAppBotState" ADD VALUE 'TRACK_SELECT';

-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN "trackingContext" JSONB;
