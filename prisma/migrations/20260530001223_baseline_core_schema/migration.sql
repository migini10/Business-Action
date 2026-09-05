-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('EN_ATTENTE', 'EN_TRAITEMENT', 'OFFRE_ENVOYEE', 'VALIDE', 'REJETE');

-- CreateEnum
CREATE TYPE "TypeVehicule" AS ENUM ('PARTICULIER', 'UTILITAIRE', 'POIDS_LOURD', 'DEUX_ROUES');

-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('A_VENIR', 'PAYE', 'EN_RETARD');

-- CreateEnum
CREATE TYPE "TypeTransaction" AS ENUM ('PAIEMENT', 'DETTE', 'CREANCE', 'REMBOURSEMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "numeroDossier" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "typeVehicule" "TypeVehicule" NOT NULL,
    "rectoUrl" TEXT,
    "versoUrl" TEXT,
    "devisUrl" TEXT,
    "statut" "StatutDossier" NOT NULL DEFAULT 'EN_ATTENTE',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Echeance" (
    "id" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'A_VENIR',
    "description" TEXT,
    "dossierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Echeance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "type" "TypeTransaction" NOT NULL,
    "description" TEXT NOT NULL,
    "commentaire" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Payé',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isModificationPending" BOOLEAN NOT NULL DEFAULT false,
    "pendingModification" JSONB,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_numeroDossier_key" ON "Dossier"("numeroDossier");

-- AddForeignKey
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Echeance" ADD CONSTRAINT "Echeance_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
