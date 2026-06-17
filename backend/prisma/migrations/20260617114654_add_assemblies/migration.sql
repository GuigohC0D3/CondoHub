-- CreateEnum
CREATE TYPE "AssemblyType" AS ENUM ('ORDINARIA', 'EXTRAORDINARIA');

-- CreateEnum
CREATE TYPE "AssemblyMode" AS ENUM ('PRESENCIAL', 'VIRTUAL', 'HIBRIDA');

-- CreateEnum
CREATE TYPE "AssemblyStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AssemblyItemStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuorumRule" AS ENUM ('SIMPLE_MAJORITY', 'ABSOLUTE_MAJORITY', 'TWO_THIRDS', 'UNANIMITY');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN', 'OPTION');

-- AlterTable
ALTER TABLE "Apartment" ADD COLUMN     "idealFraction" DECIMAL(9,6);

-- CreateTable
CREATE TABLE "Assembly" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notice" TEXT NOT NULL,
    "type" "AssemblyType" NOT NULL DEFAULT 'ORDINARIA',
    "mode" "AssemblyMode" NOT NULL DEFAULT 'VIRTUAL',
    "status" "AssemblyStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "quorumFirst" DECIMAL(4,3) NOT NULL DEFAULT 0.5,
    "quorumSecond" DECIMAL(4,3),
    "meetingUrl" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "minutesUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assembly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyItem" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quorumRule" "QuorumRule" NOT NULL DEFAULT 'SIMPLE_MAJORITY',
    "status" "AssemblyItemStatus" NOT NULL DEFAULT 'PENDING',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "approved" BOOLEAN,
    "resultJson" JSONB,

    CONSTRAINT "AssemblyItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyOption" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssemblyOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyVote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "residentId" TEXT,
    "optionId" TEXT,
    "choice" "VoteChoice" NOT NULL,
    "weight" DECIMAL(9,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssemblyAttendance" (
    "id" TEXT NOT NULL,
    "assemblyId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "residentId" TEXT,
    "weight" DECIMAL(9,6) NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssemblyAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assembly_condominiumId_status_scheduledFor_idx" ON "Assembly"("condominiumId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AssemblyItem_assemblyId_order_idx" ON "AssemblyItem"("assemblyId", "order");

-- CreateIndex
CREATE INDEX "AssemblyOption_itemId_idx" ON "AssemblyOption"("itemId");

-- CreateIndex
CREATE INDEX "AssemblyVote_itemId_idx" ON "AssemblyVote"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyVote_itemId_apartmentId_key" ON "AssemblyVote"("itemId", "apartmentId");

-- CreateIndex
CREATE INDEX "AssemblyAttendance_assemblyId_idx" ON "AssemblyAttendance"("assemblyId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyAttendance_assemblyId_apartmentId_key" ON "AssemblyAttendance"("assemblyId", "apartmentId");

-- AddForeignKey
ALTER TABLE "Assembly" ADD CONSTRAINT "Assembly_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyItem" ADD CONSTRAINT "AssemblyItem_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyOption" ADD CONSTRAINT "AssemblyOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssemblyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyVote" ADD CONSTRAINT "AssemblyVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssemblyItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyVote" ADD CONSTRAINT "AssemblyVote_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyVote" ADD CONSTRAINT "AssemblyVote_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyVote" ADD CONSTRAINT "AssemblyVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AssemblyOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyAttendance" ADD CONSTRAINT "AssemblyAttendance_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "Assembly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyAttendance" ADD CONSTRAINT "AssemblyAttendance_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssemblyAttendance" ADD CONSTRAINT "AssemblyAttendance_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
