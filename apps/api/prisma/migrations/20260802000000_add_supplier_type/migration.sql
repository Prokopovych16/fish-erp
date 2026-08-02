-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('FISH', 'SERVICES', 'SUPPLIES');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN "type" "SupplierType";
