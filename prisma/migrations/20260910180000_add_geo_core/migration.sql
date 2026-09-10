-- AlterTable
ALTER TABLE "User" ADD COLUMN     "geoCommuneId" TEXT;

-- CreateTable
CREATE TABLE "GeoCountry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoRegion" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoDepartment" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoCommune" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoCommune_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoCountry_code_key" ON "GeoCountry"("code");

-- CreateIndex
CREATE INDEX "GeoRegion_countryId_idx" ON "GeoRegion"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoRegion_countryId_name_key" ON "GeoRegion"("countryId", "name");

-- CreateIndex
CREATE INDEX "GeoDepartment_regionId_idx" ON "GeoDepartment"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoDepartment_regionId_name_key" ON "GeoDepartment"("regionId", "name");

-- CreateIndex
CREATE INDEX "GeoCommune_departmentId_idx" ON "GeoCommune"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoCommune_departmentId_name_key" ON "GeoCommune"("departmentId", "name");

-- CreateIndex
CREATE INDEX "User_geoCommuneId_idx" ON "User"("geoCommuneId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_geoCommuneId_fkey" FOREIGN KEY ("geoCommuneId") REFERENCES "GeoCommune"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoRegion" ADD CONSTRAINT "GeoRegion_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "GeoCountry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoDepartment" ADD CONSTRAINT "GeoDepartment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "GeoRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoCommune" ADD CONSTRAINT "GeoCommune_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "GeoDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
