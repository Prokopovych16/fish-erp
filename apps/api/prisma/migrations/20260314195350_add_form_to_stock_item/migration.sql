/*
  Warnings:

  - A unique constraint covering the columns `[warehouseId,productId,form]` on the table `StockItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "StockItem_warehouseId_productId_key";

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN     "form" "Form" NOT NULL DEFAULT 'FORM_1';

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_warehouseId_productId_form_key" ON "StockItem"("warehouseId", "productId", "form");
