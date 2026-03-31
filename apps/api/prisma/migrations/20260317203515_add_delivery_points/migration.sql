-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryPointId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryPoint" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryPoint_clientId_isActive_idx" ON "DeliveryPoint"("clientId", "isActive");

-- AddForeignKey
ALTER TABLE "DeliveryPoint" ADD CONSTRAINT "DeliveryPoint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryPointId_fkey" FOREIGN KEY ("deliveryPointId") REFERENCES "DeliveryPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
