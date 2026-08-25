-- CreateTable
CREATE TABLE "TrackingSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TrackingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackingSession_tokenHash_key" ON "TrackingSession"("tokenHash");

-- CreateIndex
CREATE INDEX "TrackingSession_dossierId_idx" ON "TrackingSession"("dossierId");

-- CreateIndex
CREATE INDEX "TrackingSession_expiresAt_idx" ON "TrackingSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
