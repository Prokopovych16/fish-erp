-- CreateTable
CREATE TABLE "BazaarAssortmentItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayUnit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BazaarAssortmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BazaarAssortmentItem_clientId_idx" ON "BazaarAssortmentItem"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BazaarAssortmentItem_clientId_productId_key" ON "BazaarAssortmentItem"("clientId", "productId");

-- AddForeignKey
ALTER TABLE "BazaarAssortmentItem" ADD CONSTRAINT "BazaarAssortmentItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BazaarAssortmentItem" ADD CONSTRAINT "BazaarAssortmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
