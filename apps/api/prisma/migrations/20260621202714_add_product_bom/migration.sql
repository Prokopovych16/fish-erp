-- CreateTable
CREATE TABLE "ProductBOM" (
    "id" TEXT NOT NULL,
    "outputProductId" TEXT NOT NULL,
    "inputProductId" TEXT NOT NULL,
    "yieldPct" DECIMAL(5,2) NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBOM_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductBOM_outputProductId_idx" ON "ProductBOM"("outputProductId");

-- CreateIndex
CREATE INDEX "ProductBOM_inputProductId_idx" ON "ProductBOM"("inputProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBOM_outputProductId_inputProductId_key" ON "ProductBOM"("outputProductId", "inputProductId");

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBOM" ADD CONSTRAINT "ProductBOM_inputProductId_fkey" FOREIGN KEY ("inputProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
