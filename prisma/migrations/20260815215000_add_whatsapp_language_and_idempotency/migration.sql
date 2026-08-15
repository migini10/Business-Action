ALTER TABLE "WhatsAppConversation" ADD COLUMN "language" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN "autoReplyToId" TEXT;
CREATE UNIQUE INDEX "WhatsAppMessage_autoReplyToId_key" ON "WhatsAppMessage"("autoReplyToId");
