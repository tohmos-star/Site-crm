-- CreateEnum
CREATE TYPE "GuestRegStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "intercomUrl" TEXT,
ADD COLUMN     "doorCodeMain" TEXT,
ADD COLUMN     "doorCodeSecond" TEXT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "agentToken" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "docPhotoPath" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "regStatus" "GuestRegStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "selfiePhotoPath" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "reportCleanDesk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCleanHeadset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportCleanPc" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportPhotoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Zone" ADD COLUMN     "defaultTariffId" TEXT;

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_agentToken_key" ON "Device"("agentToken");

-- CreateIndex
CREATE INDEX "Guest_regStatus_idx" ON "Guest"("regStatus");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_defaultTariffId_fkey" FOREIGN KEY ("defaultTariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
