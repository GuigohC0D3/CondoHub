-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('CONDO_FEE', 'RESERVATION', 'EXTRA');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ChargeMethod" AS ENUM ('PIX', 'BOLETO');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "residentId" TEXT,
    "batchId" TEXT,
    "kind" "ChargeKind" NOT NULL DEFAULT 'CONDO_FEE',
    "description" TEXT NOT NULL,
    "referenceMonth" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "fineAmount" DECIMAL(12,2),
    "interestAmount" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "method" "ChargeMethod" NOT NULL DEFAULT 'PIX',
    "gatewayChargeId" TEXT,
    "pixPayload" TEXT,
    "pixQrCodeUrl" TEXT,
    "boletoUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeBatch" (
    "id" TEXT NOT NULL,
    "condominiumId" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "totalCharges" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Charge_gatewayChargeId_key" ON "Charge"("gatewayChargeId");

-- CreateIndex
CREATE INDEX "Charge_condominiumId_status_dueDate_idx" ON "Charge"("condominiumId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Charge_apartmentId_idx" ON "Charge"("apartmentId");

-- CreateIndex
CREATE INDEX "Charge_referenceMonth_idx" ON "Charge"("referenceMonth");

-- CreateIndex
CREATE INDEX "ChargeBatch_condominiumId_idx" ON "ChargeBatch"("condominiumId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeBatch_condominiumId_referenceMonth_key" ON "ChargeBatch"("condominiumId", "referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ChargeBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBatch" ADD CONSTRAINT "ChargeBatch_condominiumId_fkey" FOREIGN KEY ("condominiumId") REFERENCES "Condominium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
