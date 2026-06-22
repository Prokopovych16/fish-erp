-- CreateTable
CREATE TABLE "RecipeSheet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStage" (
    "id" TEXT NOT NULL,
    "recipeSheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT,
    "tempInfo" TEXT,
    "timeInfo" TEXT,
    "isCriticalPoint" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeSheet_sortOrder_idx" ON "RecipeSheet"("sortOrder");

-- CreateIndex
CREATE INDEX "RecipeStage_recipeSheetId_sortOrder_idx" ON "RecipeStage"("recipeSheetId", "sortOrder");

-- AddForeignKey
ALTER TABLE "RecipeStage" ADD CONSTRAINT "RecipeStage_recipeSheetId_fkey" FOREIGN KEY ("recipeSheetId") REFERENCES "RecipeSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
