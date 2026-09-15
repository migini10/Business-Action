-- CreateEnum
CREATE TYPE "InsuranceContractStatus" AS ENUM ('BROUILLON_OCR', 'VALIDE', 'RENOUVELE', 'ANNULE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "ContractSourceMode" AS ENUM ('AUTOMATIQUE', 'MANUEL');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('J_MINUS_7', 'J_MINUS_2');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PREVU', 'ENVOYE', 'ECHOUE', 'ANNULE');

-- CreateEnum
CREATE TYPE "AttestationStatus" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REMPLACEE', 'REVOGUEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "InsuranceContract" (
    "id" TEXT NOT NULL,
    "numeroPolice" TEXT NOT NULL,
    "compagnie" TEXT NOT NULL,
    "assureNom" TEXT NOT NULL,
    "immatriculation" TEXT NOT NULL,
    "marqueModele" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "statut" "InsuranceContractStatus" NOT NULL DEFAULT 'VALIDE',
    "sourceMode" "ContractSourceMode" NOT NULL DEFAULT 'MANUEL',
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "notes" TEXT,
    "userId" TEXT,
    "dossierId" TEXT,
    "previousContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceAttestation" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "numeroAttestation" TEXT,
    "pdfStoragePath" TEXT,
    "pngStoragePath" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "statut" "AttestationStatus" NOT NULL DEFAULT 'VALIDE',
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttestationAccessToken" (
    "id" TEXT NOT NULL,
    "attestationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttestationAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceReminder" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "statut" "ReminderStatus" NOT NULL DEFAULT 'PREVU',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsuranceContract_clientPhone_idx" ON "InsuranceContract"("clientPhone");

-- CreateIndex
CREATE INDEX "InsuranceContract_immatriculation_idx" ON "InsuranceContract"("immatriculation");

-- CreateIndex
CREATE INDEX "InsuranceContract_dateExpiration_idx" ON "InsuranceContract"("dateExpiration");

-- CreateIndex
CREATE INDEX "InsuranceContract_statut_idx" ON "InsuranceContract"("statut");

-- CreateIndex
CREATE INDEX "InsuranceContract_userId_idx" ON "InsuranceContract"("userId");

-- CreateIndex
CREATE INDEX "InsuranceContract_dossierId_idx" ON "InsuranceContract"("dossierId");

-- CreateIndex
CREATE INDEX "InsuranceAttestation_contractId_idx" ON "InsuranceAttestation"("contractId");

-- CreateIndex
CREATE INDEX "InsuranceAttestation_statut_idx" ON "InsuranceAttestation"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "AttestationAccessToken_tokenHash_key" ON "AttestationAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AttestationAccessToken_attestationId_idx" ON "AttestationAccessToken"("attestationId");

-- CreateIndex
CREATE INDEX "AttestationAccessToken_expiresAt_idx" ON "AttestationAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "InsuranceReminder_contractId_idx" ON "InsuranceReminder"("contractId");

-- CreateIndex
CREATE INDEX "InsuranceReminder_statut_scheduledFor_idx" ON "InsuranceReminder"("statut", "scheduledFor");

-- CreateIndex
CREATE INDEX "InsuranceReminder_contractId_type_statut_idx" ON "InsuranceReminder"("contractId", "type", "statut");

-- AddForeignKey
ALTER TABLE "InsuranceContract" ADD CONSTRAINT "InsuranceContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContract" ADD CONSTRAINT "InsuranceContract_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceContract" ADD CONSTRAINT "InsuranceContract_previousContractId_fkey" FOREIGN KEY ("previousContractId") REFERENCES "InsuranceContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceAttestation" ADD CONSTRAINT "InsuranceAttestation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "InsuranceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttestationAccessToken" ADD CONSTRAINT "AttestationAccessToken_attestationId_fkey" FOREIGN KEY ("attestationId") REFERENCES "InsuranceAttestation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceReminder" ADD CONSTRAINT "InsuranceReminder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "InsuranceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
