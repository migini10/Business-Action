-- CreateEnum
CREATE TYPE "WhatsAppBotState" AS ENUM ('IDLE', 'QUOTE_VEHICLE', 'QUOTE_CONFIRM');

-- AlterTable
ALTER TABLE "WhatsAppConversation" ADD COLUMN "botState" "WhatsAppBotState" NOT NULL DEFAULT 'IDLE';
ALTER TABLE "WhatsAppConversation" ADD COLUMN "draftQuote" JSONB;
