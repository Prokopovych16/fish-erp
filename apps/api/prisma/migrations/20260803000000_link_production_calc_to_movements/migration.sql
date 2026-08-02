-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "productionCalcId" TEXT;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productionCalcId_fkey"
  FOREIGN KEY ("productionCalcId") REFERENCES "ProductionCalc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "StockMovement_productionCalcId_idx" ON "StockMovement"("productionCalcId");
