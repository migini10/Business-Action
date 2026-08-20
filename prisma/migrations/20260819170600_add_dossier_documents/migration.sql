CREATE TYPE "DossierDocumentType" AS ENUM ('CARTE_GRISE', 'CMC');
CREATE TYPE "DossierDocumentSide" AS ENUM ('RECTO', 'VERSO', 'SINGLE');

CREATE TABLE "DossierDocument" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" "DossierDocumentType" NOT NULL,
    "side" "DossierDocumentSide" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "DossierDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DossierDocument_dossierId_idx" ON "DossierDocument"("dossierId");
CREATE INDEX "DossierDocument_expiresAt_deletedAt_idx" ON "DossierDocument"("expiresAt", "deletedAt");

ALTER TABLE "DossierDocument" ADD CONSTRAINT "DossierDocument_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
