-- CreateEnum
CREATE TYPE "DocumentFlowChoice" AS ENUM ('NONE', 'CARTE_GRISE', 'CMC');

-- AlterTable
ALTER TABLE "Dossier" ADD COLUMN     "documentFlow" "DocumentFlowChoice" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "MediaStaging" ADD COLUMN     "dossierId" TEXT;

-- AddForeignKey
ALTER TABLE "MediaStaging" ADD CONSTRAINT "MediaStaging_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

