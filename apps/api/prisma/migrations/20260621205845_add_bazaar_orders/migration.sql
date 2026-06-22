-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isBazaar" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "returnedWeight" DECIMAL(10,3);
