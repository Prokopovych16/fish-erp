-- CreateTable
CREATE TABLE "ClientReturn" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClientReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "totalQty" DECIMAL(10,3) NOT NULL,
    "goodQty" DECIMAL(10,3) NOT NULL,
    "wasteQty" DECIMAL(10,3) NOT NULL,
    "warehouseId" TEXT NOT NULL,

    CONSTRAINT "ClientReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientReturn_clientId_resolvedAt_idx" ON "ClientReturn"("clientId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ClientReturn_createdAt_idx" ON "ClientReturn"("createdAt");

-- CreateIndex
CREATE INDEX "ClientReturnItem_returnId_idx" ON "ClientReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ClientReturnItem_productId_idx" ON "ClientReturnItem"("productId");

-- AddForeignKey
ALTER TABLE "ClientReturn" ADD CONSTRAINT "ClientReturn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReturnItem" ADD CONSTRAINT "ClientReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ClientReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReturnItem" ADD CONSTRAINT "ClientReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReturnItem" ADD CONSTRAINT "ClientReturnItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
