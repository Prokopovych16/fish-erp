-- AlterTable
ALTER TABLE "ClientReturn" ADD COLUMN     "deliveryPointId" TEXT;

-- CreateIndex
CREATE INDEX "ClientReturn_deliveryPointId_resolvedAt_idx" ON "ClientReturn"("deliveryPointId", "resolvedAt");

-- AddForeignKey
ALTER TABLE "ClientReturn" ADD CONSTRAINT "ClientReturn_deliveryPointId_fkey" FOREIGN KEY ("deliveryPointId") REFERENCES "DeliveryPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
