-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_name_key" ON "ProductGroup"("name");
CREATE INDEX "ProductGroup_name_idx" ON "ProductGroup"("name");

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Product_groupId_idx" ON "Product"("groupId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
