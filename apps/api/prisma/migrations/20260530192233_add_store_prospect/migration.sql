-- CreateTable
CREATE TABLE "StoreProspect" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "chain" TEXT,
    "address" TEXT,
    "oblast" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "openingHours" TEXT,
    "website" TEXT,
    "isWorking" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreProspect_osmId_key" ON "StoreProspect"("osmId");

-- CreateIndex
CREATE INDEX "StoreProspect_oblast_idx" ON "StoreProspect"("oblast");

-- CreateIndex
CREATE INDEX "StoreProspect_chain_idx" ON "StoreProspect"("chain");

-- CreateIndex
CREATE INDEX "StoreProspect_isWorking_idx" ON "StoreProspect"("isWorking");
