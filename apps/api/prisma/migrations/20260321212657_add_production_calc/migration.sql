-- CreateTable
CREATE TABLE "ProductionCalc" (
    "id" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalInputCost" DECIMAL(10,2) NOT NULL,
    "totalOutputQty" DECIMAL(10,3) NOT NULL,
    "costPerKg" DECIMAL(10,4) NOT NULL,

    CONSTRAINT "ProductionCalc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCalcInput" (
    "id" TEXT NOT NULL,
    "calcId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "form" "Form" NOT NULL,

    CONSTRAINT "ProductionCalcInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCalcOutput" (
    "id" TEXT NOT NULL,
    "calcId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "costPerKg" DECIMAL(10,4) NOT NULL,
    "markupPct" DECIMAL(5,2),
    "salePricePerKg" DECIMAL(10,2),
    "margin" DECIMAL(10,2),
    "form" "Form" NOT NULL,

    CONSTRAINT "ProductionCalcOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionCalc_createdAt_idx" ON "ProductionCalc"("createdAt");

-- CreateIndex
CREATE INDEX "ProductionCalcInput_calcId_idx" ON "ProductionCalcInput"("calcId");

-- CreateIndex
CREATE INDEX "ProductionCalcOutput_calcId_idx" ON "ProductionCalcOutput"("calcId");

-- AddForeignKey
ALTER TABLE "ProductionCalcInput" ADD CONSTRAINT "ProductionCalcInput_calcId_fkey" FOREIGN KEY ("calcId") REFERENCES "ProductionCalc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCalcOutput" ADD CONSTRAINT "ProductionCalcOutput_calcId_fkey" FOREIGN KEY ("calcId") REFERENCES "ProductionCalc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
