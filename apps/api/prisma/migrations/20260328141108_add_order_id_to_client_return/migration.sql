-- AlterTable
ALTER TABLE "ClientReturn" ADD COLUMN     "orderId" TEXT;

-- AddForeignKey
ALTER TABLE "ClientReturn" ADD CONSTRAINT "ClientReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
